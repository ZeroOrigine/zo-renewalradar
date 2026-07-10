// CANONICAL: POST /api/cron/alerts — the alert dispatcher. THE product promise:
// email the owner BEFORE the charge hits / the cancel window closes.
//
// Auth: Authorization: Bearer ${CRON_SECRET} (middleware PATCH v3 exempts
// /api/cron/* from session checks — the secret IS the authentication).
// Schedule: Deploy Mind wires a daily POST (Netlify scheduled function or
// external cron).
//
// Env (deploy step must add): CRON_SECRET (required), RESEND_API_KEY +
// EMAIL_FROM (email provider). If email is unconfigured, due rows are counted
// as skipped and RETRIED next run — an alert is never silently dropped,
// because last_alert_at only advances after a confirmed send.
//
// Idempotency: setting last_alert_at fires the BEFORE UPDATE trigger, which
// recomputes next_alert_at strictly AFTER last_alert_at — the same window can
// never double-send.

import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BATCH_SIZE = 200

interface DueRenewal {
  id: string
  user_id: string
  vendor_name: string
  amount: number
  currency: string
  next_renewal_date: string
  cancel_by_date: string | null
  auto_renews: boolean
}

async function sendAlertEmail(to: string, subject: string, text: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) {
    return false // unconfigured — caller counts as skipped, row retries next run
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text }),
    })
    if (!response.ok) {
      console.error('[cron/alerts] email send failed:', response.status, await response.text().catch(() => ''))
    }
    return response.ok
  } catch (error) {
    console.error('[cron/alerts] email send threw:', error)
    return false
  }
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/alerts] CRON_SECRET is not set — refusing to run.')
    return NextResponse.json({ error: 'Cron secret not configured.', code: 'CONFIG' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  try {
    const db = createServiceRoleClient()

    // 1. Expire lapsed items / roll auto-renewals forward (SECURITY DEFINER fn).
    const { data: rolled, error: rollError } = await db.rpc('renewalradar_roll_overdue_renewals')
    if (rollError) {
      console.error('[cron/alerts] roll function failed:', rollError.message)
    }

    // 2. Sweep due alerts (covered by idx_renewalradar_renewals_due_alerts).
    const { data: due, error: dueError } = await db
      .from('renewalradar_renewals')
      .select('id, user_id, vendor_name, amount, currency, next_renewal_date, cancel_by_date, auto_renews')
      .eq('status', 'active')
      .lte('next_alert_at', new Date().toISOString())
      .order('next_alert_at', { ascending: true })
      .limit(BATCH_SIZE)
    if (dueError) {
      throw dueError
    }

    const rows = (due ?? []) as DueRenewal[]
    let sent = 0
    let skipped = 0

    if (rows.length > 0) {
      const userIds = Array.from(new Set(rows.map((row) => row.user_id)))
      const { data: profiles, error: profileError } = await db
        .from('renewalradar_profiles')
        .select('id, email, full_name')
        .in('id', userIds)
      if (profileError) {
        throw profileError
      }
      const profileMap = new Map((profiles ?? []).map((p) => [p.id as string, p as { email: string | null; full_name: string | null }]))
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '')

      for (const row of rows) {
        const profile = profileMap.get(row.user_id)
        if (!profile?.email) {
          skipped += 1
          continue
        }
        const cancelLine =
          row.auto_renews && row.cancel_by_date
            ? `\nLast safe day to cancel: ${row.cancel_by_date}.`
            : ''
        const subject = `${row.vendor_name} renews on ${row.next_renewal_date}`
        const text = `Hi${profile.full_name ? ` ${profile.full_name}` : ''},\n\n${row.vendor_name} renews on ${row.next_renewal_date} (${row.currency} ${row.amount}).${cancelLine}\n\nReview or cancel it: ${appUrl}/renewals/${row.id}\n\n— RenewalRadar`
        const ok = await sendAlertEmail(profile.email, subject, text)
        if (!ok) {
          skipped += 1
          continue // last_alert_at NOT advanced — retried next run
        }
        const { error: updateError } = await db
          .from('renewalradar_renewals')
          .update({ last_alert_at: new Date().toISOString() })
          .eq('id', row.id)
        if (updateError) {
          console.error(`[cron/alerts] failed to advance alert state for ${row.id}:`, updateError.message)
        } else {
          sent += 1
        }
      }
    }

    return NextResponse.json({ rolled: rolled ?? 0, due: rows.length, sent, skipped })
  } catch (error) {
    console.error('[cron/alerts] run failed:', error)
    return NextResponse.json({ error: 'Alert run failed.', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

// Convenience for manual verification with the same bearer secret.
export async function GET(request: Request) {
  return POST(request)
}
