// CANONICAL: /api/renewals/export — CSV download of every renewal.
// Plan-gated: csv_export must be enabled on the user's plan (Pro/Business).
//
// Unauthenticated handling matrix (ecosystem learning): a browser navigation
// (Accept: text/html) is redirected to /login?next=..., while fetch() callers
// get a JSON 401 — a human is never dead-ended on raw JSON.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/db/api'
import { getEntitlements } from '@/lib/db/entitlements'
import { listRenewalsForExport } from '@/lib/db/renewals'
import type { Renewal } from '@/lib/db/types'

export const dynamic = 'force-dynamic'

function csvEscape(value: string): string {
  // Formula-injection guard: spreadsheet apps execute cells starting with = + - @
  const guarded = /^[=+\-@]/.test(value) ? `'${value}` : value
  if (/[",\n\r]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`
  }
  return guarded
}

function renewalsToCsv(renewals: Renewal[]): string {
  const header = [
    'vendor_name',
    'vendor_url',
    'category',
    'amount',
    'currency',
    'billing_cycle',
    'next_renewal_date',
    'cancel_by_date',
    'cancel_notice_days',
    'auto_renews',
    'status',
    'monthly_amount',
    'alert_days_before',
    'notes',
    'created_at',
  ]

  const lines = renewals.map((renewal) =>
    [
      csvEscape(renewal.vendor_name),
      csvEscape(renewal.vendor_url ?? ''),
      renewal.category,
      String(renewal.amount),
      renewal.currency,
      renewal.billing_cycle,
      renewal.next_renewal_date,
      renewal.cancel_by_date ?? '',
      String(renewal.cancel_notice_days),
      renewal.auto_renews ? 'yes' : 'no',
      renewal.status,
      renewal.monthly_amount === null ? '' : String(renewal.monthly_amount),
      csvEscape((renewal.alert_days_before ?? []).join('|')),
      csvEscape(renewal.notes ?? ''),
      renewal.created_at,
    ].join(',')
  )

  return [header.join(','), ...lines].join('\r\n') + '\r\n'
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      const acceptsHtml = (request.headers.get('accept') ?? '').includes('text/html')
      if (acceptsHtml) {
        const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
        const origin = configuredOrigin || new URL(request.url).origin
        return NextResponse.redirect(
          `${origin}/login?next=${encodeURIComponent('/api/renewals/export')}`
        )
      }
      return apiError(
        'You need to be signed in to export your renewals. Please log in and try again.',
        'UNAUTHENTICATED',
        401
      )
    }

    const entitlements = await getEntitlements(supabase, user.id)
    if (!entitlements.csv_export) {
      return apiError(
        'CSV export is a Pro feature. Upgrade to download your full renewal list any time.',
        'UPGRADE_REQUIRED',
        403
      )
    }

    const renewals = await listRenewalsForExport(supabase, user.id)
    const csv = renewalsToCsv(renewals)
    const today = new Date().toISOString().slice(0, 10)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="renewalradar-export-${today}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[api/renewals/export] GET failed:', error)
    return apiError(
      "We couldn't build your export just now. Please try again in a moment.",
      'INTERNAL_ERROR',
      500
    )
  }
}
