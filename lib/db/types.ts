// CANONICAL: RenewalRadar database row types, enum tuples, and API envelope
// contracts. Single source of truth for every table this product touches.
// All tables live in a shared Supabase database and are prefixed
// `renewalradar_` — never query a table that is not listed here.

// ---------------------------------------------------------------------------
// Enum tuples (mirrors the Postgres enums exactly). Exported as const tuples
// so route handlers can build Zod enums from the same source of truth.
// ---------------------------------------------------------------------------

export const RENEWAL_STATUSES = ['active', 'paused', 'canceled', 'expired'] as const
export type RenewalStatus = (typeof RENEWAL_STATUSES)[number]

export const BILLING_CYCLES = [
  'weekly',
  'monthly',
  'quarterly',
  'semi_annual',
  'annual',
  'biennial',
  'custom',
] as const
export type BillingCycle = (typeof BILLING_CYCLES)[number]

export const RENEWAL_CATEGORIES = [
  'software',
  'infrastructure',
  'domain',
  'insurance',
  'marketing',
  'finance',
  'office',
  'other',
] as const
export type RenewalCategory = (typeof RENEWAL_CATEGORIES)[number]

export type UserRole = 'user' | 'admin'

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'paused'

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded'

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  default_currency: string
  timezone: string
  default_alert_days: number[]
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

export interface Renewal {
  id: string
  user_id: string
  vendor_name: string
  vendor_url: string | null
  category: RenewalCategory
  amount: number
  currency: string
  billing_cycle: BillingCycle
  next_renewal_date: string
  auto_renews: boolean
  cancel_notice_days: number
  status: RenewalStatus
  alert_days_before: number[]
  next_alert_at: string | null
  last_alert_at: string | null
  notes: string | null
  /** Generated in the DB: last safe day to cancel before the charge hits. */
  cancel_by_date: string | null
  /** Generated in the DB: cost normalized to monthly units; null for custom cycles. */
  monthly_amount: number | null
  created_at: string
  updated_at: string
}

export interface PlanFeatures {
  email_alerts?: boolean
  max_alert_windows?: number
  csv_export?: boolean
  slack_alerts?: boolean
  team_seats?: number
  priority_support?: boolean
}

export interface Plan {
  id: string
  slug: string
  name: string
  description: string | null
  price_monthly_cents: number
  price_yearly_cents: number
  stripe_price_id_monthly: string | null
  stripe_price_id_yearly: string | null
  max_renewals: number | null
  features: PlanFeatures
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan: string
  status: SubscriptionStatus
  current_period_end: string | null
  cancel_at_period_end: boolean
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  user_id: string
  stripe_payment_intent_id: string | null
  stripe_checkout_session_id: string | null
  amount_cents: number
  currency: string
  description: string | null
  status: PaymentStatus
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// API envelope — every JSON endpoint returns exactly one of these two shapes.
// ---------------------------------------------------------------------------

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  total_pages: number
}

export interface ApiSuccess<T> {
  data: T
  error: null
}

export interface ApiFailure {
  data: null
  /** Human-readable message, safe to render directly in the UI. */
  error: string
  /** Stable machine-readable code, e.g. VALIDATION_FAILED. */
  code: string
  /** Field-level validation messages, keyed by field path. */
  fields?: Record<string, string>
}
