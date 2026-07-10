// CANONICAL: Stripe webhook event handlers — the ONLY code that mutates
// renewalradar_subscriptions / renewalradar_payments (via the service role;
// those tables deliberately have no client write policies).
//
// Design rules:
//  - IDEMPOTENT: every write is an upsert keyed on a unique column, so Stripe
//    retries and out-of-order delivery can never corrupt state.
//  - USER RESOLUTION is belt-and-braces: metadata.renewalradar_user_id first
//    (set at checkout on both session and subscription), then customer-id lookup
//    (the customer id is persisted BEFORE checkout redirect, so it always resolves).
//  - VERSION-TOLERANT: fields that moved between Stripe API versions
//    (current_period_end, invoice.payment_intent, invoice.subscription) are read
//    through defensive helpers.
//  - Throwing here → webhook route returns 500 → Stripe retries. A missing user
//    mapping logs and returns cleanly (retrying would never fix it).

import type Stripe from 'stripe'
import { getBillingDb } from './db'
import { isPaidPlan, resolvePlanFromPriceId, type PlanSlug } from './config'

const SUBSCRIPTIONS_TABLE = 'renewalradar_subscriptions'
const PAYMENTS_TABLE = 'renewalradar_payments'

/** The exact events the Deploy Mind must subscribe the webhook endpoint to. */
export const STRIPE_WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
] as const

// Mirrors renewalradar_subscription_status enum — 1:1 with Stripe statuses.
const VALID_STATUSES = new Set([
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid',
  'paused',
])

function mapSubscriptionStatus(stripeStatus: string): string {
  return VALID_STATUSES.has(stripeStatus) ? stripeStatus : 'incomplete'
}

function customerIdOf(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!customer) return null
  return typeof customer === 'string' ? customer : customer.id
}

async function findUserId(
  customerId: string | null,
  metadata?: Stripe.Metadata | null
): Promise<string | null> {
  const fromMeta = metadata?.renewalradar_user_id
  if (fromMeta) return fromMeta
  if (!customerId) return null
  const { data, error } = await getBillingDb()
    .from(SUBSCRIPTIONS_TABLE)
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  if (error) {
    throw new Error(`User lookup by customer ${customerId} failed: ${error.message}`)
  }
  return data?.user_id ?? null
}

// --- version-tolerant field extraction -------------------------------------

function getPeriodEndIso(sub: Stripe.Subscription): string | null {
  const direct = (sub as unknown as { current_period_end?: number }).current_period_end
  const fromItem = (sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined)
    ?.current_period_end
  const unix = direct ?? fromItem ?? null
  return unix ? new Date(unix * 1000).toISOString() : null
}

function getInvoicePaymentIntentId(invoice: Stripe.Invoice): string | null {
  const inv = invoice as unknown as {
    payment_intent?: string | { id: string } | null
    payments?: { data?: Array<{ payment?: { payment_intent?: string | { id: string } | null } }> }
  }
  const raw = inv.payment_intent ?? inv.payments?.data?.[0]?.payment?.payment_intent ?? null
  if (!raw) return null
  return typeof raw === 'string' ? raw : raw.id
}

function invoiceIsForSubscription(invoice: Stripe.Invoice): boolean {
  const inv = invoice as unknown as {
    subscription?: unknown
    parent?: { subscription_details?: { subscription?: unknown } }
  }
  return Boolean(inv.subscription ?? inv.parent?.subscription_details?.subscription)
}

function invoiceSubscriptionMetadata(invoice: Stripe.Invoice): Stripe.Metadata | null {
  const inv = invoice as unknown as {
    subscription_details?: { metadata?: Stripe.Metadata }
    parent?: { subscription_details?: { metadata?: Stripe.Metadata } }
  }
  return inv.subscription_details?.metadata ?? inv.parent?.subscription_details?.metadata ?? null
}

// --- event handlers ----------------------------------------------------------

async function onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const customerId = customerIdOf(session.customer as string | Stripe.Customer | null)
  const userId =
    session.client_reference_id ??
    session.metadata?.renewalradar_user_id ??
    (await findUserId(customerId, session.metadata))
  if (!userId) {
    console.error(`[stripe] checkout.session.completed ${session.id}: could not resolve user — skipping.`)
    return
  }
  const db = getBillingDb()

  if (session.mode === 'subscription') {
    // Persist the customer link + optimistic plan. Authoritative status/period
    // arrives via customer.subscription.* events (idempotent upserts both ways).
    const plan = isPaidPlan(session.metadata?.plan) ? session.metadata?.plan : undefined
    const { error } = await db
      .from(SUBSCRIPTIONS_TABLE)
      .upsert(
        {
          user_id: userId,
          ...(customerId ? { stripe_customer_id: customerId } : {}),
          ...(plan ? { plan } : {}),
        },
        { onConflict: 'user_id' }
      )
    if (error) throw new Error(`checkout.session.completed upsert failed: ${error.message}`)
    return
  }

  if (session.mode === 'payment') {
    // One-time purchases (future-proofing; receipts land in billing history).
    const { error } = await db.from(PAYMENTS_TABLE).upsert(
      {
        user_id: userId,
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id ?? null,
        amount_cents: session.amount_total ?? 0,
        currency: (session.currency ?? 'usd').toLowerCase(),
        description: 'RenewalRadar one-time purchase',
        status: session.payment_status === 'paid' ? 'succeeded' : 'pending',
      },
      { onConflict: 'stripe_checkout_session_id' }
    )
    if (error) throw new Error(`checkout payment record failed: ${error.message}`)
  }
}

async function onSubscriptionUpsert(sub: Stripe.Subscription): Promise<void> {
  const customerId = customerIdOf(sub.customer as string | Stripe.Customer)
  const userId = await findUserId(customerId, sub.metadata)
  if (!userId) {
    console.error(`[stripe] subscription ${sub.id}: no user for customer ${customerId} — skipping.`)
    return
  }

  const priceId = sub.items?.data?.[0]?.price?.id ?? null
  const plan: PlanSlug | null =
    (isPaidPlan(sub.metadata?.plan) ? (sub.metadata?.plan as PlanSlug) : null) ??
    resolvePlanFromPriceId(priceId)

  const { error } = await getBillingDb()
    .from(SUBSCRIPTIONS_TABLE)
    .upsert(
      {
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        status: mapSubscriptionStatus(sub.status),
        cancel_at_period_end: sub.cancel_at_period_end ?? false,
        current_period_end: getPeriodEndIso(sub),
        ...(plan ? { plan } : {}), // never blindly overwrite plan when unresolvable
      },
      { onConflict: 'user_id' }
    )
  if (error) throw new Error(`subscription upsert failed for ${sub.id}: ${error.message}`)
}

async function onSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const customerId = customerIdOf(sub.customer as string | Stripe.Customer)
  const userId = await findUserId(customerId, sub.metadata)
  if (!userId) {
    console.error(`[stripe] subscription.deleted ${sub.id}: no user for customer ${customerId} — skipping.`)
    return
  }
  // Downgrade to Free ('active' is the free-tier convention). Keep the customer id
  // so a future re-subscribe reuses the same Stripe customer + invoice history.
  const { error } = await getBillingDb()
    .from(SUBSCRIPTIONS_TABLE)
    .update({
      plan: 'free',
      status: 'active',
      stripe_subscription_id: null,
      current_period_end: null,
      cancel_at_period_end: false,
    })
    .eq('user_id', userId)
  if (error) throw new Error(`subscription.deleted downgrade failed: ${error.message}`)
}

async function onInvoicePayment(invoice: Stripe.Invoice, outcome: 'succeeded' | 'failed'): Promise<void> {
  const customerId = customerIdOf(invoice.customer as string | Stripe.Customer | null)
  const userId = await findUserId(customerId, invoiceSubscriptionMetadata(invoice))
  if (!userId) {
    console.error(`[stripe] invoice ${invoice.id}: no user for customer ${customerId} — skipping.`)
    return
  }
  const db = getBillingDb()

  // Failed subscription payment → mark past_due immediately (subscription.updated
  // will confirm; this is belt-and-braces so the app can react right away).
  if (outcome === 'failed' && invoiceIsForSubscription(invoice)) {
    const { error } = await db
      .from(SUBSCRIPTIONS_TABLE)
      .update({ status: 'past_due' })
      .eq('user_id', userId)
    if (error) throw new Error(`past_due update failed: ${error.message}`)
  }

  // Receipt row. Only invoices with a real payment attempt carry a payment intent;
  // $0 invoices (full-discount, plan-change zero-prorations) are intentionally skipped.
  const paymentIntentId = getInvoicePaymentIntentId(invoice)
  if (!paymentIntentId) return

  const amountCents = outcome === 'succeeded' ? invoice.amount_paid ?? 0 : invoice.amount_due ?? 0
  const description =
    invoice.lines?.data?.[0]?.description ?? `RenewalRadar subscription (${invoice.number ?? invoice.id})`

  const { error } = await db.from(PAYMENTS_TABLE).upsert(
    {
      user_id: userId,
      stripe_payment_intent_id: paymentIntentId,
      amount_cents: Math.max(0, amountCents),
      currency: (invoice.currency ?? 'usd').toLowerCase(),
      description,
      status: outcome,
    },
    { onConflict: 'stripe_payment_intent_id' }
  )
  if (error) throw new Error(`payment record failed for invoice ${invoice.id}: ${error.message}`)
}

// --- dispatcher ---------------------------------------------------------------

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      return onCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      return onSubscriptionUpsert(event.data.object as Stripe.Subscription)
    case 'customer.subscription.deleted':
      return onSubscriptionDeleted(event.data.object as Stripe.Subscription)
    case 'invoice.payment_succeeded':
      return onInvoicePayment(event.data.object as Stripe.Invoice, 'succeeded')
    case 'invoice.payment_failed':
      return onInvoicePayment(event.data.object as Stripe.Invoice, 'failed')
    default:
      // Unsubscribed/unknown events are acknowledged and ignored.
      return
  }
}
