// CANONICAL: /billing — REQUIRED by the auth_payments flow contract.
// Reads ?intent=pro|business (surface upgrade immediately), ?checkout=success
// (celebrate — CHECKOUT_SUCCESS_PATH points here), and ?checkout=canceled
// (reassure: no charge). Server component loads subscription + receipts via
// RLS; the client component handles checkout/portal POSTs.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEntitlements } from '@/lib/db/entitlements'
import { PLANS, type PlanSlug } from '@/lib/stripe/config'
import { BillingClient, type BillingPaymentRow } from './billing-client'

export const dynamic = 'force-dynamic'

interface BillingPageProps {
  searchParams: { intent?: string; checkout?: string }
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/billing')
  }

  const entitlements = await getEntitlements(supabase, user.id).catch(() => null)

  const { data: subscription } = await supabase
    .from('renewalradar_subscriptions')
    .select('plan, status, current_period_end, cancel_at_period_end, stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: payments } = await supabase
    .from('renewalradar_payments')
    .select('id, amount_cents, currency, description, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(12)

  const currentPlan = ((subscription?.plan as PlanSlug | undefined) ?? 'free') in PLANS
    ? ((subscription?.plan as PlanSlug | undefined) ?? 'free')
    : 'free'

  const rawIntent = searchParams.intent
  const intent = rawIntent === 'pro' || rawIntent === 'business' ? rawIntent : null
  const checkout =
    searchParams.checkout === 'success' || searchParams.checkout === 'canceled'
      ? searchParams.checkout
      : null

  return (
    <BillingClient
      currentPlan={currentPlan}
      planName={entitlements?.plan_name ?? PLANS[currentPlan].name}
      status={(subscription?.status as string | undefined) ?? 'active'}
      currentPeriodEnd={(subscription?.current_period_end as string | null | undefined) ?? null}
      cancelAtPeriodEnd={Boolean(subscription?.cancel_at_period_end)}
      hasBillingAccount={Boolean(subscription?.stripe_customer_id)}
      intent={intent}
      checkout={checkout}
      payments={(payments ?? []) as BillingPaymentRow[]}
    />
  )
}
