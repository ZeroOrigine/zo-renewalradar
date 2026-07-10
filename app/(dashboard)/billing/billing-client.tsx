'use client'

// CANONICAL: RenewalRadar billing UI — plan cards from lib/stripe/config (the
// single price source), checkout + portal actions, success/canceled banners.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { PAID_PLANS, PLANS, formatPrice, type BillingInterval, type PaidPlanSlug, type PlanSlug } from '@/lib/stripe/config'
import { ToastViewport, useToast } from '@/lib/core/toast'

export interface BillingPaymentRow {
  id: string
  amount_cents: number
  currency: string
  description: string | null
  status: string
  created_at: string
}

interface BillingClientProps {
  currentPlan: PlanSlug
  planName: string
  status: string
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  hasBillingAccount: boolean
  intent: PaidPlanSlug | null
  checkout: 'success' | 'canceled' | null
  payments: BillingPaymentRow[]
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function BillingClient(props: BillingClientProps) {
  const { toast, showToast } = useToast()
  const [interval, setInterval] = useState<BillingInterval>('monthly')
  const [busyPlan, setBusyPlan] = useState<PaidPlanSlug | null>(null)
  const [portalBusy, setPortalBusy] = useState(false)
  const [dismissedBanner, setDismissedBanner] = useState(false)

  const isPaid = props.currentPlan !== 'free'

  const orderedPlans = useMemo(() => (['free', ...PAID_PLANS] as PlanSlug[]).map((slug) => PLANS[slug]), [])

  async function startCheckout(plan: PaidPlanSlug) {
    setBusyPlan(plan)
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, interval }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.url) {
        showToast(json?.error?.message ?? "We couldn't start checkout — nothing was charged. Try again.", 'error')
        return
      }
      window.location.assign(json.url as string)
    } catch {
      showToast("We couldn't reach the server. Check your connection and try again.", 'error')
    } finally {
      setBusyPlan(null)
    }
  }

  async function openPortal() {
    setPortalBusy(true)
    try {
      const response = await fetch('/api/billing/portal', { method: 'POST' })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.url) {
        showToast(json?.error?.message ?? "We couldn't open the billing portal just now. Try again.", 'error')
        return
      }
      window.location.assign(json.url as string)
    } catch {
      showToast("We couldn't reach the server. Check your connection and try again.", 'error')
    } finally {
      setPortalBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      <ToastViewport toast={toast} />

      <header className="animate-rise">
        <h1 className="text-2xl">Billing</h1>
        <p className="mt-1 text-sm text-slate-600">Your plan, your receipts, your rules — change or cancel anytime.</p>
      </header>

      {props.checkout === 'success' && !dismissedBanner && (
        <div role="status" className="animate-pop flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="text-2xl" aria-hidden="true">🎉</span>
            <div>
              <p className="font-semibold text-emerald-900">Welcome to {props.planName}!</p>
              <p className="mt-0.5 text-sm text-emerald-800">Your upgrade is live. Unlimited radar coverage starts now.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/renewals/new" className="btn-primary whitespace-nowrap">Add a renewal</Link>
            <button type="button" onClick={() => setDismissedBanner(true)} className="text-sm font-medium text-emerald-700 hover:text-emerald-600">Dismiss</button>
          </div>
        </div>
      )}

      {props.checkout === 'canceled' && !dismissedBanner && (
        <div role="status" className="animate-pop flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-700">
            Checkout was canceled and <span className="font-semibold">nothing was charged</span>. Your current plan is untouched — upgrade whenever you're ready.
          </p>
          <button type="button" onClick={() => setDismissedBanner(true)} className="self-start text-sm font-medium text-slate-600 hover:text-slate-900 sm:self-auto">Dismiss</button>
        </div>
      )}

      <section aria-label="Current plan" className="card animate-rise-1 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Current plan</p>
          <p className="mt-1 font-display text-2xl font-bold text-slate-900">{props.planName}</p>
          <p className="mt-1 text-sm text-slate-600">
            {isPaid
              ? props.cancelAtPeriodEnd && props.currentPeriodEnd
                ? `Cancels at period end — you keep everything until ${formatDateTime(props.currentPeriodEnd)}.`
                : props.currentPeriodEnd
                  ? `Renews ${formatDateTime(props.currentPeriodEnd)}. Yes, we track our own renewal too.`
                  : 'Active subscription.'
              : 'Free forever — track up to 5 renewals with email alerts.'}
          </p>
          {props.status === 'past_due' && (
            <p className="mt-2 text-sm font-semibold text-rose-600">Your last payment didn't go through — update your card to keep Pro features.</p>
          )}
        </div>
        {props.hasBillingAccount ? (
          <button type="button" onClick={openPortal} disabled={portalBusy} className="btn-secondary whitespace-nowrap">
            {portalBusy ? 'Opening…' : 'Manage billing'}
          </button>
        ) : (
          <p className="text-sm text-slate-500">Invoices and card management appear here after your first upgrade.</p>
        )}
      </section>

      <section aria-label="Plans" className="animate-rise-2 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg">Plans</h2>
          <div role="group" aria-label="Billing interval" className="flex gap-1 self-start rounded-xl bg-slate-100 p-1">
            {(['monthly', 'yearly'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setInterval(option)}
                aria-pressed={interval === option}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${interval === option ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {option === 'monthly' ? 'Monthly' : 'Yearly (2 months free)'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {orderedPlans.map((plan) => {
            const cents = interval === 'monthly' ? plan.priceMonthlyCents : plan.priceYearlyCents
            const isCurrent = plan.slug === props.currentPlan
            const isIntent = plan.slug === props.intent
            const paid = plan.slug !== 'free'
            return (
              <div
                key={plan.slug}
                className={`card flex flex-col p-6 ${isIntent ? 'border-indigo-400 ring-2 ring-indigo-200' : plan.highlight ? 'border-indigo-200' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900">{plan.name}</h3>
                  {isCurrent && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Current</span>}
                  {isIntent && !isCurrent && <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">Your pick</span>}
                </div>
                <p className="mt-1 text-sm text-slate-500">{plan.tagline}</p>
                <p className="mt-4 font-display text-3xl font-extrabold text-slate-900">
                  {formatPrice(cents)}
                  <span className="text-sm font-medium text-slate-400">{paid ? (interval === 'monthly' ? '/mo' : '/yr') : ''}</span>
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-600">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <span aria-hidden="true" className="text-emerald-500">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {paid ? (
                    isCurrent ? (
                      <button type="button" onClick={openPortal} disabled={portalBusy} className="btn-secondary w-full">
                        {portalBusy ? 'Opening…' : 'Manage in portal'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startCheckout(plan.slug as PaidPlanSlug)}
                        disabled={busyPlan !== null}
                        className="btn-primary w-full"
                      >
                        {busyPlan === plan.slug ? 'Starting checkout…' : `Get ${plan.name} — ${formatPrice(cents)}${interval === 'monthly' ? '/mo' : '/yr'}`}
                      </button>
                    )
                  ) : isCurrent ? (
                    <p className="text-center text-sm text-slate-500">You're on Free — no card on file.</p>
                  ) : (
                    <button type="button" onClick={openPortal} disabled={portalBusy} className="btn-secondary w-full">
                      {portalBusy ? 'Opening…' : 'Downgrade in portal'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section aria-label="Payment history" className="animate-rise-3 space-y-3">
        <h2 className="text-lg">Receipts</h2>
        {props.payments.length === 0 ? (
          <div className="card p-6 text-center text-sm text-slate-600">No payments yet — receipts land here after your first upgrade.</div>
        ) : (
          <ul className="card divide-y divide-slate-100">
            {props.payments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{payment.description ?? 'RenewalRadar subscription'}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(payment.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{formatPrice(payment.amount_cents)}</p>
                  <span className={`text-xs font-semibold ${payment.status === 'succeeded' ? 'text-emerald-600' : payment.status === 'failed' ? 'text-rose-600' : 'text-slate-500'}`}>
                    {payment.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
