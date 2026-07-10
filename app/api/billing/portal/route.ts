// CANONICAL: POST /api/billing/portal — opens the Stripe Billing Portal.
// Contract (consumed by the core step's manage-subscription UI):
//   POST {} → 200 { url: string }   (redirect the browser to url)
//   400 no_billing_account → user is on Free with nothing to manage yet.
//
// The portal is where users update cards, switch plans, download invoices, and
// cancel — users own their billing, always (Stripe hosts it; we never see cards).
// RATE LIMITING: same guidance as /api/checkout (~10 req/min per user at the edge).

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createBillingPortalSession } from '@/lib/stripe/portal'
import { BILLING_PORTAL_RETURN_PATH } from '@/lib/stripe/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status })
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonError(403, 'bad_origin', 'This request must come from the RenewalRadar app.')
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonError(503, 'config', "We're not fully configured yet — try again in a few minutes.")
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // ignore
        }
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return jsonError(401, 'unauthorized', 'Please sign in to manage billing.')
  }

  // RLS lets users read their own subscription row — no service role needed here.
  const { data: subscription, error: readError } = await supabase
    .from('renewalradar_subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (readError) {
    console.error('[api/billing/portal] subscription read failed:', readError.message)
    return jsonError(500, 'read_failed', "We couldn't load your billing details. Give it another try in a moment.")
  }

  if (!subscription?.stripe_customer_id) {
    return jsonError(
      400,
      'no_billing_account',
      "You're on the Free plan — there's nothing to manage yet. Upgrade to Pro and this is where you'll change or cancel it."
    )
  }

  try {
    const base = (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') || new URL(request.url).origin)
    const url = await createBillingPortalSession(
      subscription.stripe_customer_id,
      `${base}${BILLING_PORTAL_RETURN_PATH}`
    )
    return NextResponse.json({ url })
  } catch (err) {
    console.error('[api/billing/portal] failed:', err)
    return jsonError(500, 'portal_failed', "We couldn't open the billing portal just now. Give it another try.")
  }
}
