// CANONICAL: POST /api/webhooks/stripe — the ONLY writer of billing state.
// SECURITY (NON-NEGOTIABLE): every request is verified against STRIPE_WEBHOOK_SECRET
// via constructEvent on the RAW body. No signature → no processing. The signature IS
// the authentication — middleware exempts this path from session checks on purpose.
//
// Behavior contract:
//   - Invalid signature → 400 (Stripe stops retrying bad requests)
//   - Handler/database failure → 500 (Stripe retries with backoff — handlers are idempotent)
//   - Handled or intentionally ignored event → 200 { received: true }

import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/client'
import { handleStripeEvent } from '@/lib/stripe/webhooks'

// Stripe's Node SDK requires the Node runtime (raw body + crypto), never edge.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error('[webhooks/stripe] STRIPE_WEBHOOK_SECRET is not set — refusing to process events.')
    return NextResponse.json({ error: { code: 'config', message: 'Webhook secret not configured.' } }, { status: 500 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: { code: 'missing_signature', message: 'Missing stripe-signature header.' } }, { status: 400 })
  }

  // The RAW request body is required for signature verification — never parse JSON first.
  const payload = await request.text()

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret)
  } catch (err) {
    console.error('[webhooks/stripe] signature verification failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: { code: 'invalid_signature', message: 'Invalid signature.' } }, { status: 400 })
  }

  try {
    await handleStripeEvent(event)
  } catch (err) {
    // Return 500 so Stripe retries — all handlers are idempotent upserts.
    console.error(`[webhooks/stripe] handler failed for ${event.type} (${event.id}):`, err)
    return NextResponse.json({ error: { code: 'handler_failed', message: 'Event processing failed.' } }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
