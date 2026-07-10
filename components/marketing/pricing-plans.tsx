// CANONICAL: components/marketing/pricing-plans.tsx — pricing cards + billing
// toggle for the landing and pricing pages.
// PATCH v2: plan data now comes ONLY from @/lib/stripe/config (flow contract).
// The previous version advertised prices and an 'enterprise' plan that do not
// exist in the billing system.
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PAID_PLANS, PLANS, formatPrice, type PlanSlug } from '@/lib/stripe/config'

const PLAN_ORDER: PlanSlug[] = ['free', ...PAID_PLANS]

const FOOTNOTES: Record<PlanSlug, string> = {
  free: 'Free forever. No credit card.',
  pro: 'Starts instantly. Cancel anytime.',
  business: 'Starts instantly. Cancel anytime.',
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true">
      <path d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}

export default function PricingPlans() {
  const [annual, setAnnual] = useState(false)

  return (
    <div>
      <div className="flex justify-center">
        <div role="group" aria-label="Billing period" className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setAnnual(false)}
            aria-pressed={!annual}
            className={`min-h-[44px] rounded-full px-5 text-sm font-semibold transition ${!annual ? 'bg-emerald-600 text-white shadow' : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'}`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setAnnual(true)}
            aria-pressed={annual}
            className={`min-h-[44px] rounded-full px-5 text-sm font-semibold transition ${annual ? 'bg-emerald-600 text-white shadow' : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'}`}
          >
            Annual
            <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${annual ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'}`}>
              2 months free
            </span>
          </button>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 items-stretch gap-8 lg:grid-cols-3">
        {PLAN_ORDER.map((slug) => {
          const plan = PLANS[slug]
          const paid = plan.priceMonthlyCents > 0
          // FLOW CONTRACT: paid CTAs link to /signup?plan=pro|business.
          const href = paid ? `/signup?plan=${plan.slug}` : '/signup'
          const perMonthCents = annual ? Math.round(plan.priceYearlyCents / 12) : plan.priceMonthlyCents
          const ctaLabel = !paid
            ? 'Start free'
            : `Get ${plan.name} — ${formatPrice(perMonthCents)}/mo`

          return (
            <div
              key={plan.slug}
              className={`relative flex flex-col rounded-3xl border bg-white p-8 dark:bg-slate-950 ${plan.highlight ? 'border-2 border-emerald-500 shadow-xl shadow-emerald-500/10' : 'border-slate-200 shadow-sm dark:border-slate-800'}`}
            >
              {plan.highlight && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-500 px-3.5 py-1 text-xs font-bold uppercase tracking-wide text-slate-950">
                  Most popular
                </span>
              )}

              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{plan.name}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{plan.tagline}</p>

              <p className="mt-6 flex items-baseline gap-1.5">
                <span className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">{formatPrice(perMonthCents)}</span>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">/mo</span>
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {!paid
                  ? 'Free forever — not a trial'
                  : annual
                    ? `Billed annually (${formatPrice(plan.priceYearlyCents)}/yr) — 2 months free`
                    : 'Billed monthly. Cancel anytime.'}
              </p>

              <ul className="mt-8 flex-1 space-y-3 text-sm text-slate-700 dark:text-slate-300">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-3">
                    <CheckIcon />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <Link
                  href={href}
                  className={`inline-flex min-h-[48px] w-full items-center justify-center rounded-xl px-6 py-3.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${plan.highlight ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/25 hover:-translate-y-0.5 hover:bg-emerald-400' : 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-transparent dark:text-white dark:hover:bg-white/5'}`}
                >
                  {ctaLabel}
                </Link>
                <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">{FOOTNOTES[plan.slug]}</p>
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
        Prices in USD. Everyone starts on Free — upgrade only when you outgrow 5 renewals. One caught renewal usually covers years of Pro.
      </p>
    </div>
  )
}
