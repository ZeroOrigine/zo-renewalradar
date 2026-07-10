// CANONICAL: the single source of truth for RenewalRadar plans and billing paths.
// PATCH v2: CHECKOUT_SUCCESS_PATH now lands on /billing?checkout=success — the
// billing page owns the celebration moment (and ?checkout=canceled reassurance).
// MUST stay in lockstep with the seeded `renewalradar_plans` rows (slugs
// free/pro/business, prices in cents). Do NOT invent other slugs.
//
// Import-safe on the client: static plan data ships fine; STRIPE_PRICE_* lookups
// return null in the browser because those env vars are server-only.

export type PlanSlug = 'free' | 'pro' | 'business'
export type PaidPlanSlug = 'pro' | 'business'
export type BillingInterval = 'monthly' | 'yearly'

export const PAID_PLANS: readonly PaidPlanSlug[] = ['pro', 'business'] as const

export interface PlanConfig {
  slug: PlanSlug
  name: string
  tagline: string
  priceMonthlyCents: number
  priceYearlyCents: number
  /** null = unlimited (matches renewalradar_plans.max_renewals) */
  maxRenewals: number | null
  features: string[]
  highlight?: boolean
  limits: {
    emailAlerts: boolean
    maxAlertWindows: number
    csvExport: boolean
    slackAlerts: boolean
    teamSeats: number
    prioritySupport: boolean
  }
}

export const PLANS: Record<PlanSlug, PlanConfig> = {
  free: {
    slug: 'free',
    name: 'Free',
    tagline: 'Never miss the renewals that matter most.',
    priceMonthlyCents: 0,
    priceYearlyCents: 0,
    maxRenewals: 5,
    features: [
      'Track up to 5 renewals',
      'Email alerts before every charge',
      '2 alert windows per renewal (30 & 7 days)',
      'Cancel-by date on every renewal',
    ],
    limits: {
      emailAlerts: true,
      maxAlertWindows: 2,
      csvExport: false,
      slackAlerts: false,
      teamSeats: 1,
      prioritySupport: false,
    },
  },
  pro: {
    slug: 'pro',
    name: 'Pro',
    tagline: 'Full radar coverage for your whole stack.',
    priceMonthlyCents: 900, // $9/mo — matches renewalradar_plans seed
    priceYearlyCents: 8900, // $89/yr — matches renewalradar_plans seed
    maxRenewals: null,
    features: [
      'Unlimited renewals',
      'Custom alert schedules — up to 6 windows',
      'Slack alerts',
      'CSV export — your data is always yours',
      'Everything in Free',
    ],
    highlight: true,
    limits: {
      emailAlerts: true,
      maxAlertWindows: 6,
      csvExport: true,
      slackAlerts: true,
      teamSeats: 1,
      prioritySupport: false,
    },
  },
  business: {
    slug: 'business',
    name: 'Business',
    tagline: 'One radar for the whole team.',
    priceMonthlyCents: 2900, // $29/mo — matches renewalradar_plans seed
    priceYearlyCents: 29000, // $290/yr — matches renewalradar_plans seed
    maxRenewals: null,
    features: [
      'Everything in Pro',
      '5 team seats',
      'Priority support',
    ],
    limits: {
      emailAlerts: true,
      maxAlertWindows: 6,
      csvExport: true,
      slackAlerts: true,
      teamSeats: 5,
      prioritySupport: true,
    },
  },
}

export function isPaidPlan(value: unknown): value is PaidPlanSlug {
  return value === 'pro' || value === 'business'
}

/** "$9" or "$8.50" from cents. */
export function formatPrice(cents: number): string {
  const dollars = cents / 100
  return `$${cents % 100 === 0 ? dollars.toString() : dollars.toFixed(2)}`
}

export function getStripePriceId(plan: PaidPlanSlug, interval: BillingInterval): string | null {
  const map: Record<PaidPlanSlug, Record<BillingInterval, string | undefined>> = {
    pro: {
      monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
      yearly: process.env.STRIPE_PRICE_PRO_YEARLY,
    },
    business: {
      monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
      yearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY,
    },
  }
  return map[plan][interval] || null
}

export function resolvePlanFromPriceId(priceId: string | null | undefined): PlanSlug | null {
  if (!priceId) return null
  for (const plan of PAID_PLANS) {
    for (const interval of ['monthly', 'yearly'] as const) {
      if (getStripePriceId(plan, interval) === priceId) return plan
    }
  }
  return null
}

// Post-checkout navigation contract. The /billing page (core step) handles both
// outcomes: success = celebration, canceled = "nothing was charged" reassurance.
export const CHECKOUT_SUCCESS_PATH = '/billing?checkout=success'
export const CHECKOUT_CANCEL_PATH = '/billing?checkout=canceled'
export const BILLING_PORTAL_RETURN_PATH = '/billing'
