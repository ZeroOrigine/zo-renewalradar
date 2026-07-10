// CANONICAL: RenewalRadar renewals service — the ONLY module that queries
// renewalradar_renewals (the product kernel). All reads select explicit
// columns (never *), all list queries paginate, and every hot path is covered
// by a schema index (idx_renewalradar_renewals_user_next et al).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { BillingCycle, Renewal, RenewalCategory, RenewalStatus } from '@/lib/db/types'

// Explicit column list — includes the DB-generated killer insights
// (cancel_by_date, monthly_amount) that make the dashboard instant.
export const RENEWAL_COLUMNS =
  'id, user_id, vendor_name, vendor_url, category, amount, currency, billing_cycle, next_renewal_date, auto_renews, cancel_notice_days, status, alert_days_before, next_alert_at, last_alert_at, notes, cancel_by_date, monthly_amount, created_at, updated_at'

export type RenewalSortColumn =
  | 'next_renewal_date'
  | 'vendor_name'
  | 'amount'
  | 'monthly_amount'
  | 'created_at'

export interface ListRenewalsOptions {
  from: number
  to: number
  status?: RenewalStatus
  category?: RenewalCategory
  search?: string
  sort?: RenewalSortColumn
  direction?: 'asc' | 'desc'
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`)
}

export async function listRenewals(
  supabase: SupabaseClient,
  userId: string,
  options: ListRenewalsOptions
): Promise<{ renewals: Renewal[]; total: number }> {
  let query = supabase
    .from('renewalradar_renewals')
    .select(RENEWAL_COLUMNS, { count: 'exact' })
    .eq('user_id', userId)

  if (options.status) {
    query = query.eq('status', options.status)
  }
  if (options.category) {
    query = query.eq('category', options.category)
  }
  if (options.search) {
    query = query.ilike('vendor_name', `%${escapeLikePattern(options.search)}%`)
  }

  const sortColumn: RenewalSortColumn = options.sort ?? 'next_renewal_date'
  const ascending = (options.direction ?? 'asc') === 'asc'

  const { data, error, count } = await query
    .order(sortColumn, { ascending, nullsFirst: false })
    .order('id', { ascending: true }) // stable tie-break keeps pagination deterministic
    .range(options.from, options.to)

  if (error) {
    throw error
  }
  return { renewals: (data ?? []) as Renewal[], total: count ?? 0 }
}

export async function getRenewalById(
  supabase: SupabaseClient,
  userId: string,
  renewalId: string
): Promise<Renewal | null> {
  const { data, error } = await supabase
    .from('renewalradar_renewals')
    .select(RENEWAL_COLUMNS)
    .eq('id', renewalId)
    .eq('user_id', userId) // defense in depth on top of RLS
    .maybeSingle()

  if (error) {
    throw error
  }
  return (data as Renewal | null) ?? null
}

export interface CreateRenewalInput {
  vendor_name: string
  vendor_url: string | null
  category: RenewalCategory
  amount: number
  currency: string
  billing_cycle: BillingCycle
  next_renewal_date: string
  auto_renews: boolean
  cancel_notice_days: number
  alert_days_before: number[]
  notes: string | null
}

export async function createRenewal(
  supabase: SupabaseClient,
  userId: string,
  input: CreateRenewalInput
): Promise<Renewal> {
  const { data, error } = await supabase
    .from('renewalradar_renewals')
    .insert({ ...input, user_id: userId })
    .select(RENEWAL_COLUMNS)
    .single()

  if (error) {
    throw error
  }
  return data as Renewal
}

export interface UpdateRenewalInput {
  vendor_name?: string
  vendor_url?: string | null
  category?: RenewalCategory
  amount?: number
  currency?: string
  billing_cycle?: BillingCycle
  next_renewal_date?: string
  auto_renews?: boolean
  cancel_notice_days?: number
  status?: RenewalStatus
  alert_days_before?: number[]
  notes?: string | null
}

export async function updateRenewal(
  supabase: SupabaseClient,
  userId: string,
  renewalId: string,
  patch: UpdateRenewalInput
): Promise<Renewal | null> {
  const { data, error } = await supabase
    .from('renewalradar_renewals')
    .update(patch)
    .eq('id', renewalId)
    .eq('user_id', userId)
    .select(RENEWAL_COLUMNS)
    .maybeSingle()

  if (error) {
    throw error
  }
  return (data as Renewal | null) ?? null
}

export async function deleteRenewal(
  supabase: SupabaseClient,
  userId: string,
  renewalId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('renewalradar_renewals')
    .delete()
    .eq('id', renewalId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error) {
    throw error
  }
  return data !== null
}

/**
 * Renewals that count toward the plan limit: things the user is actively
 * tracking. Canceled/expired history never blocks adding something new.
 */
export async function countTrackedRenewals(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('renewalradar_renewals')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', ['active', 'paused'])

  if (error) {
    throw error
  }
  return count ?? 0
}

/** Dedupe, drop out-of-range values, and sort descending (e.g. [30, 7, 1]). */
export function normalizeAlertDays(alertDays: number[]): number[] {
  const unique = Array.from(
    new Set(alertDays.filter((days) => Number.isInteger(days) && days >= 0 && days <= 365))
  )
  unique.sort((a, b) => b - a)
  return unique
}

// ---------------------------------------------------------------------------
// Dashboard summary — the money-at-a-glance payload that makes the first
// three seconds of the dashboard land ("Your subscriptions cost $X/month.
// Two cancel windows close this week.").
// ---------------------------------------------------------------------------

export interface UpcomingRenewal {
  id: string
  vendor_name: string
  category: RenewalCategory
  amount: number
  currency: string
  billing_cycle: BillingCycle
  next_renewal_date: string
  cancel_by_date: string | null
  auto_renews: boolean
  days_until_renewal: number
  days_until_cancel_deadline: number | null
}

export interface CurrencyTotal {
  currency: string
  monthly_total: number
  annual_projection: number
  renewal_count: number
}

export interface RenewalsSummary {
  active_count: number
  primary_currency: string
  monthly_total: number
  annual_projection: number
  totals_by_currency: CurrencyTotal[]
  /** Renewals on a custom cycle: excluded from totals so the math stays honest. */
  custom_cycle_count: number
  next_renewal: UpcomingRenewal | null
  upcoming_renewals: UpcomingRenewal[]
  /** Auto-renewing items whose cancel deadline lands within 7 days — act now. */
  closing_cancel_windows: UpcomingRenewal[]
}

interface SummaryRow {
  id: string
  vendor_name: string
  category: RenewalCategory
  amount: number
  currency: string
  billing_cycle: BillingCycle
  next_renewal_date: string
  cancel_by_date: string | null
  auto_renews: boolean
  monthly_amount: number | null
}

const MILLISECONDS_PER_DAY = 86_400_000

function startOfTodayUtc(): number {
  const now = new Date()
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
}

function daysFromToday(isoDate: string, todayUtcMs: number): number {
  const target = new Date(`${isoDate}T00:00:00Z`).getTime()
  return Math.round((target - todayUtcMs) / MILLISECONDS_PER_DAY)
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export async function getRenewalsSummary(
  supabase: SupabaseClient,
  userId: string
): Promise<RenewalsSummary> {
  const { data, error } = await supabase
    .from('renewalradar_renewals')
    .select(
      'id, vendor_name, category, amount, currency, billing_cycle, next_renewal_date, cancel_by_date, auto_renews, monthly_amount'
    )
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('next_renewal_date', { ascending: true })
    .limit(1000)

  if (error) {
    throw error
  }

  const rows = (data ?? []) as SummaryRow[]
  const todayUtcMs = startOfTodayUtc()

  const toUpcoming = (row: SummaryRow): UpcomingRenewal => ({
    id: row.id,
    vendor_name: row.vendor_name,
    category: row.category,
    amount: Number(row.amount),
    currency: row.currency,
    billing_cycle: row.billing_cycle,
    next_renewal_date: row.next_renewal_date,
    cancel_by_date: row.cancel_by_date,
    auto_renews: row.auto_renews,
    days_until_renewal: daysFromToday(row.next_renewal_date, todayUtcMs),
    days_until_cancel_deadline: row.cancel_by_date
      ? daysFromToday(row.cancel_by_date, todayUtcMs)
      : null,
  })

  const totalsMap = new Map<string, CurrencyTotal>()
  let customCycleCount = 0

  for (const row of rows) {
    if (row.monthly_amount === null) {
      customCycleCount += 1
      continue
    }
    const existing = totalsMap.get(row.currency) ?? {
      currency: row.currency,
      monthly_total: 0,
      annual_projection: 0,
      renewal_count: 0,
    }
    existing.monthly_total += Number(row.monthly_amount)
    existing.renewal_count += 1
    totalsMap.set(row.currency, existing)
  }

  const totalsByCurrency = Array.from(totalsMap.values())
    .map((total) => ({
      ...total,
      monthly_total: roundMoney(total.monthly_total),
      annual_projection: roundMoney(total.monthly_total * 12),
    }))
    .sort((a, b) => b.monthly_total - a.monthly_total)

  const primary = totalsByCurrency[0] ?? null
  const enriched = rows.map(toUpcoming)

  const upcomingRenewals = enriched
    .filter((item) => item.days_until_renewal >= 0 && item.days_until_renewal <= 30)
    .slice(0, 10)

  const closingCancelWindows = enriched
    .filter(
      (item) =>
        item.auto_renews &&
        item.days_until_cancel_deadline !== null &&
        item.days_until_cancel_deadline >= 0 &&
        item.days_until_cancel_deadline <= 7
    )
    .sort((a, b) => (a.days_until_cancel_deadline ?? 0) - (b.days_until_cancel_deadline ?? 0))

  const nextRenewal = enriched.find((item) => item.days_until_renewal >= 0) ?? null

  return {
    active_count: rows.length,
    primary_currency: primary?.currency ?? 'USD',
    monthly_total: primary?.monthly_total ?? 0,
    annual_projection: primary?.annual_projection ?? 0,
    totals_by_currency: totalsByCurrency,
    custom_cycle_count: customCycleCount,
    next_renewal: nextRenewal,
    upcoming_renewals: upcomingRenewals,
    closing_cancel_windows: closingCancelWindows,
  }
}

/** Full renewal list (any status) for CSV export. Capped defensively. */
export async function listRenewalsForExport(
  supabase: SupabaseClient,
  userId: string
): Promise<Renewal[]> {
  const { data, error } = await supabase
    .from('renewalradar_renewals')
    .select(RENEWAL_COLUMNS)
    .eq('user_id', userId)
    .order('next_renewal_date', { ascending: true })
    .limit(5000)

  if (error) {
    throw error
  }
  return (data ?? []) as Renewal[]
}
