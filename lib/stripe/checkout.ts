// CANONICAL: Stripe Checkout session creation for RenewalRadar subscriptions.
// Server-only (uses the service-role billing DB + secret Stripe key).
//
// Key guarantees:
//  - The Stripe customer is created and persisted BEFORE redirecting to Stripe,
//    so webhook events can always resolve customer → user (no ordering races).
//  - user_id + plan ride along as metadata on BOTH the session and the subscription.
//  - A user with an existing active subscription is routed to the Billing Portal
//    instead of a second Checkout — double-billing is structurally impossible.
//  - No trials are configured in Stripe, so no button anywhere may say "trial".

import { getStripe } from './client'
import { getBillingDb } from './db'
import { createBillingPortalSession } from './portal'
import {
  getStripePriceId,
  CHECKOUT_SUCCESS_PATH,
  CHECKOUT_CANCEL_PATH,
  BILLING_PORTAL_RETURN_PATH,
  type PaidPlanSlug,
  type BillingInterval,
} from './config'

const SUBSCRIPTIONS_TABLE = 'renewalradar_subscriptions'

/** Raised when required billing configuration (env) is missing → routes map to 503. */
export class BillingConfigError extends Error {}

function resolveAppBase(originFallback?: string): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim()
  const base = fromEnv || originFallback
  if (!base) {
    throw new BillingConfigError('NEXT_PUBLIC_APP_URL is not set and no request origin was provided.')
  }
  return base.replace(/\/+$/, '')
}

/**
 * Returns the user's Stripe customer id, creating + persisting one if needed.
 * The signup trigger guarantees a renewalradar_subscriptions row exists, but we
 * upsert defensively (partial upsert never touches the plan/status columns).
 */
export async function getOrCreateStripeCustomer(userId: string, email?: string | null): Promise<string> {
  const db = getBillingDb()

  const { data: existing, error: readError } = await db
    .from(SUBSCRIPTIONS_TABLE)
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (readError) {
    throw new Error(`Could not read subscription row for user ${userId}: ${readError.message}`)
  }
  if (existing?.stripe_customer_id) return existing.stripe_customer_id

  const customer = await getStripe().customers.create({
    email: email ?? undefined,
    metadata: { renewalradar_user_id: userId },
  })

  const { error: writeError } = await db
    .from(SUBSCRIPTIONS_TABLE)
    .upsert({ user_id: userId, stripe_customer_id: customer.id }, { onConflict: 'user_id' })
  if (writeError) {
    throw new Error(`Could not persist Stripe customer for user ${userId}: ${writeError.message}`)
  }

  return customer.id
}

export interface CheckoutResult {
  url: string
  /** 'portal' = user already subscribed; browser should still just redirect to url. */
  kind: 'checkout' | 'portal'
}

export async function createCheckoutSession(params: {
  userId: string
  email?: string | null
  plan: PaidPlanSlug
  interval: BillingInterval
  /** Used only when NEXT_PUBLIC_APP_URL is unset (e.g. local dev). */
  originFallback?: string
}): Promise<CheckoutResult> {
  const { userId, email, plan, interval, originFallback } = params

  const priceId = getStripePriceId(plan, interval)
  if (!priceId) {
    throw new BillingConfigError(`Missing Stripe price id for ${plan}/${interval} (set STRIPE_PRICE_* env vars).`)
  }

  const base = resolveAppBase(originFallback)
  const db = getBillingDb()

  const { data: subscription } = await db
    .from(SUBSCRIPTIONS_TABLE)
    .select('stripe_customer_id, stripe_subscription_id, status')
    .eq('user_id', userId)
    .maybeSingle()

  const customerId =
    subscription?.stripe_customer_id ?? (await getOrCreateStripeCustomer(userId, email))

  // Already actively subscribed → plan changes happen in the Billing Portal.
  if (
    subscription?.stripe_subscription_id &&
    ['active', 'trialing', 'past_due'].includes(subscription.status as string)
  ) {
    const url = await createBillingPortalSession(customerId, `${base}${BILLING_PORTAL_RETURN_PATH}`)
    return { url, kind: 'portal' }
  }

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    client_reference_id: userId,
    success_url: `${base}${CHECKOUT_SUCCESS_PATH}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}${CHECKOUT_CANCEL_PATH}`,
    metadata: { renewalradar_user_id: userId, plan },
    subscription_data: {
      metadata: { renewalradar_user_id: userId, plan },
    },
  })

  if (!session.url) {
    throw new Error('Stripe did not return a Checkout URL.')
  }
  return { url: session.url, kind: 'checkout' }
}
