// CANONICAL: POST /api/checkout — starts a Stripe Checkout session for a paid plan.
// Contract (consumed by the core step's billing/pricing UI):
//   POST { plan: 'pro' | 'business', interval?: 'monthly' | 'yearly' }
//   → 200 { url: string, kind: 'checkout' | 'portal' }   (redirect the browser to url)
//   kind === 'portal' means the user already has an active subscription — we send
//   them to the Billing Portal to change plans instead of double-billing them.
//
// SECURITY: middleware already requires a session for /api/*; this route STILL
// re-verifies the user (defense in depth), enforces same-origin (CSRF), and never
// touches card data — Stripe Checkout owns PCI compliance.
// RATE LIMITING: if abuse appears, cap at ~10 req/min per user at the CDN/edge;
// Stripe idempotency + the portal fallback make retries harmless.

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createCheckoutSession, BillingConfigError } from '@/lib/stripe/checkout'
import { isPaidPlan } from '@/lib/stripe/config'

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

async function createRouteClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return null
  const cookieStore = await cookies()
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // ignore — middleware keeps sessions fresh
        }
      },
    },
  })
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonError(403, 'bad_origin', 'This request must come from the RenewalRadar app.')
  }

  const supabase = await createRouteClient()
  if (!supabase) {
    return jsonError(503, 'config', "We're not fully configured yet — try again in a few minutes.")
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return jsonError(401, 'unauthorized', 'Please sign in to upgrade.')
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    // fall through — validation below responds cleanly
  }

  const plan = body.plan
  if (!isPaidPlan(plan)) {
    return jsonError(400, 'invalid_plan', 'Pick the Pro or Business plan to upgrade.')
  }
  const rawInterval = body.interval ?? 'monthly'
  if (rawInterval !== 'monthly' && rawInterval !== 'yearly') {
    return jsonError(400, 'invalid_interval', "Billing interval must be 'monthly' or 'yearly'.")
  }

  try {
    const result = await createCheckoutSession({
      userId: user.id,
      email: user.email ?? null,
      plan,
      interval: rawInterval,
      originFallback: new URL(request.url).origin,
    })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof BillingConfigError) {
      console.error('[api/checkout] billing config error:', err.message)
      return jsonError(503, 'billing_config', "Billing isn't fully set up yet. Nothing was charged — please try again soon.")
    }
    console.error('[api/checkout] failed:', err)
    return jsonError(500, 'checkout_failed', "We couldn't start checkout and nothing was charged. Give it another try.")
  }
}
