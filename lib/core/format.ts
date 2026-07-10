// CANONICAL: lib/core/format.ts — shared formatting helpers + option lists.
// Imported by dashboard pages (renewals/[id], renewals/new, settings, dashboard,
// renewals list). Pure functions only — safe in both server and client components.

import {
  BILLING_CYCLES,
  RENEWAL_CATEGORIES,
  type BillingCycle,
  type RenewalCategory,
} from '@/lib/db/types'

export const COMMON_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SEK', 'NZD', 'INR',
] as const

const CATEGORY_LABELS: Record<RenewalCategory, string> = {
  software: 'Software / SaaS',
  infrastructure: 'Infrastructure / Cloud',
  domain: 'Domain / Hosting',
  insurance: 'Insurance',
  marketing: 'Marketing',
  finance: 'Finance / Accounting',
  office: 'Office / Facilities',
  other: 'Other',
}

export const CATEGORY_OPTIONS = RENEWAL_CATEGORIES.map((value) => ({
  value,
  label: CATEGORY_LABELS[value],
}))

const CYCLE_LABELS: Record<BillingCycle, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semi_annual: 'Every 6 months',
  annual: 'Annual',
  biennial: 'Every 2 years',
  custom: 'Custom',
}

export const CYCLE_OPTIONS = BILLING_CYCLES.map((value) => ({
  value,
  label: CYCLE_LABELS[value],
}))

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

/** Accepts a date (YYYY-MM-DD) or ISO timestamp; renders e.g. "Jul 1, 2026". */
export function formatDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

const MS_PER_DAY = 86_400_000

export function daysUntil(isoDate: string): number {
  const now = new Date()
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const target = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`).getTime()
  return Math.round((target - todayUtc) / MS_PER_DAY)
}

export function daysLabel(days: number): string {
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  if (days < 0) return `${Math.abs(days)} days ago`
  return `in ${days} days`
}
