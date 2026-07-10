// CANONICAL: RenewalRadar entitlements service — resolves what the signed-in
// user's plan allows (renewal limits, alert windows, CSV export, Slack).
//
// Reads renewalradar_subscriptions + renewalradar_plans and NEVER writes
// either: billing state is mutated exclusively by the Stripe webhook handler
// (auth_payments step) using the service-role client.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PlanFeatures, SubscriptionStatus } from '@/lib/db/types'

export interface Entitlements {
  plan_slug: string
  plan_name: string
  subscription_status: SubscriptionStatus
  /** null = unlimited */
  max_renewals: number | null
  max_alert_windows: number
  csv_export: boolean
  slack_alerts: boolean
}

// Mirrors the seeded free plan. Used only if data is unexpectedly missing —
// we degrade to free-tier limits instead of failing the user's request.
const FREE_FALLBACK: Entitlements = {
  plan_slug: 'free',
  plan_name: 'Free',
  subscription_status: 'active',
  max_renewals: 5,
  max_alert_windows: 2,
  csv_export: false,
  slack_alerts: false,
}

/** Subscription statuses that keep paid features switched on. */
const ENTITLED_STATUSES: readonly SubscriptionStatus[] = ['active', 'trialing', 'past_due']

export async function getEntitlements(
  supabase: SupabaseClient,
  userId: string
): Promise<Entitlements> {
  const { data: subscription, error: subscriptionError } = await supabase
    .from('renewalradar_subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .maybeSingle()

  if (subscriptionError) {
    throw subscriptionError
  }

  // The signup trigger creates a free-tier row for every user. If it is ever
  // missing we quietly fall back to free limits.
  if (!subscription) {
    return { ...FREE_FALLBACK }
  }

  const subscriptionStatus = subscription.status as SubscriptionStatus
  const planSlug = ENTITLED_STATUSES.includes(subscriptionStatus)
    ? (subscription.plan as string)
    : 'free'

  const { data: plan, error: planError } = await supabase
    .from('renewalradar_plans')
    .select('slug, name, max_renewals, features')
    .eq('slug', planSlug)
    .eq('is_active', true)
    .maybeSingle()

  if (planError) {
    throw planError
  }

  if (!plan) {
    return { ...FREE_FALLBACK, subscription_status: subscriptionStatus }
  }

  const features = (plan.features ?? {}) as PlanFeatures

  return {
    plan_slug: plan.slug as string,
    plan_name: plan.name as string,
    subscription_status: subscriptionStatus,
    max_renewals: (plan.max_renewals as number | null) ?? null,
    max_alert_windows:
      typeof features.max_alert_windows === 'number' && features.max_alert_windows >= 1
        ? features.max_alert_windows
        : 2,
    csv_export: features.csv_export === true,
    slack_alerts: features.slack_alerts === true,
  }
}
