// CANONICAL: /api/renewals — list (GET) and create (POST) renewals, the
// RenewalRadar kernel entity. Auth required. Responses use the shared
// { data, error } envelope. Lists paginate: default 20, max 100.
//
// NOTE: auth callback/signout, checkout, billing, and Stripe webhook routes
// are owned by the auth_payments step and are intentionally NOT generated
// here (duplicate paths halt the pipeline).

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  apiError,
  apiSuccess,
  buildPaginationMeta,
  parsePagination,
  zodFieldErrors,
} from '@/lib/db/api'
import { getEntitlements } from '@/lib/db/entitlements'
import { ensureProfile } from '@/lib/db/profiles'
import {
  countTrackedRenewals,
  createRenewal,
  listRenewals,
  normalizeAlertDays,
} from '@/lib/db/renewals'
import { BILLING_CYCLES, RENEWAL_CATEGORIES, RENEWAL_STATUSES } from '@/lib/db/types'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Validation (inline Zod schemas with human error messages)
// ---------------------------------------------------------------------------

const emptyStringToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value

const numberFromString = (value: unknown) =>
  typeof value === 'string' && value.trim() !== '' ? Number(value) : value

const vendorUrlField = z.preprocess(
  emptyStringToNull,
  z
    .string()
    .trim()
    .url("That URL doesn't look right — include https:// at the start.")
    .max(2048, 'URLs max out at 2,048 characters.')
    .nullish()
)

const amountField = z.preprocess(
  numberFromString,
  z
    .number({
      required_error: 'How much does this renewal cost?',
      invalid_type_error: 'Amount should be a number, like 49.99.',
    })
    .min(0, "Amount can't be negative.")
    .max(9_999_999_999.99, 'That amount is larger than we can track.')
)

const currencyField = z
  .string({ invalid_type_error: 'Use a 3-letter currency code, like USD.' })
  .trim()
  .regex(/^[A-Za-z]{3}$/, 'Use a 3-letter currency code, like USD or EUR.')
  .transform((value) => value.toUpperCase())

const renewalDateField = z
  .string({
    required_error: 'When does this renew next?',
    invalid_type_error: 'Send the date as YYYY-MM-DD, like 2026-07-01.',
  })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Send the date as YYYY-MM-DD, like 2026-07-01.')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  }, "That date doesn't exist on the calendar — mind double-checking it?")

const alertDaysField = z
  .array(
    z
      .number({ invalid_type_error: 'Alert windows are whole numbers of days, like 30.' })
      .int('Alert windows are whole numbers of days, like 30.')
      .min(0, 'Alert windows start at 0 days (the day it renews).')
      .max(365, 'Alert windows max out at 365 days.'),
    { invalid_type_error: 'Send alert windows as a list of numbers, like [30, 7, 1].' }
  )
  .min(1, 'Keep at least one alert window so we can warn you in time.')
  .max(6, 'Six alert windows is the most any plan supports.')

const cancelNoticeDaysField = z.preprocess(
  numberFromString,
  z
    .number({ invalid_type_error: 'Cancellation notice should be a number of days, like 30.' })
    .int('Cancellation notice should be a whole number of days.')
    .min(0, "Cancellation notice can't be negative.")
    .max(365, 'Cancellation notice maxes out at 365 days.')
)

const notesField = z.preprocess(
  emptyStringToNull,
  z.string().trim().max(2000, 'Notes max out at 2,000 characters.').nullish()
)

const createRenewalSchema = z.object({
  vendor_name: z
    .string({
      required_error: 'Every renewal needs a vendor name.',
      invalid_type_error: 'Vendor name should be text.',
    })
    .trim()
    .min(1, 'Every renewal needs a vendor name.')
    .max(200, 'Vendor names max out at 200 characters.'),
  vendor_url: vendorUrlField,
  category: z
    .enum(RENEWAL_CATEGORIES, {
      errorMap: () => ({ message: `Pick one of: ${RENEWAL_CATEGORIES.join(', ')}.` }),
    })
    .default('software'),
  amount: amountField,
  currency: currencyField.default('USD'),
  billing_cycle: z
    .enum(BILLING_CYCLES, {
      errorMap: () => ({ message: `Pick one of: ${BILLING_CYCLES.join(', ')}.` }),
    })
    .default('annual'),
  next_renewal_date: renewalDateField,
  auto_renews: z
    .boolean({ invalid_type_error: 'auto_renews should be true or false.' })
    .default(true),
  cancel_notice_days: cancelNoticeDaysField.default(0),
  alert_days_before: alertDaysField.optional(),
  notes: notesField,
})

const listQuerySchema = z.object({
  status: z
    .enum(RENEWAL_STATUSES, {
      errorMap: () => ({ message: `Filter status must be one of: ${RENEWAL_STATUSES.join(', ')}.` }),
    })
    .optional(),
  category: z
    .enum(RENEWAL_CATEGORIES, {
      errorMap: () => ({
        message: `Filter category must be one of: ${RENEWAL_CATEGORIES.join(', ')}.`,
      }),
    })
    .optional(),
  search: z.string().max(200, 'Search terms max out at 200 characters.').optional(),
  sort: z
    .enum(['next_renewal_date', 'vendor_name', 'amount', 'monthly_amount', 'created_at'], {
      errorMap: () => ({
        message: 'Sort by next_renewal_date, vendor_name, amount, monthly_amount, or created_at.',
      }),
    })
    .optional(),
  direction: z
    .enum(['asc', 'desc'], {
      errorMap: () => ({ message: "Direction is either 'asc' or 'desc'." }),
    })
    .optional(),
})

// ---------------------------------------------------------------------------
// GET /api/renewals — paginated, filterable list
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return apiError(
        'You need to be signed in to view your renewals. Please log in and try again.',
        'UNAUTHENTICATED',
        401
      )
    }

    const { searchParams } = new URL(request.url)

    const parsedQuery = listQuerySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      category: searchParams.get('category') ?? undefined,
      search: searchParams.get('search')?.trim() || undefined,
      sort: searchParams.get('sort') ?? undefined,
      direction: searchParams.get('direction') ?? undefined,
    })

    if (!parsedQuery.success) {
      return apiError(
        'Some of those filters need a quick fix.',
        'INVALID_QUERY',
        400,
        zodFieldErrors(parsedQuery.error)
      )
    }

    const { page, limit, from, to } = parsePagination(searchParams)

    const { renewals, total } = await listRenewals(supabase, user.id, {
      from,
      to,
      status: parsedQuery.data.status,
      category: parsedQuery.data.category,
      search: parsedQuery.data.search,
      sort: parsedQuery.data.sort,
      direction: parsedQuery.data.direction,
    })

    return apiSuccess({
      renewals,
      pagination: buildPaginationMeta(page, limit, total),
    })
  } catch (error) {
    console.error('[api/renewals] GET failed:', error)
    return apiError(
      'We hit a snag loading your renewals. Please try again in a moment.',
      'INTERNAL_ERROR',
      500
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/renewals — create a renewal (plan limits enforced server-side)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return apiError(
        'You need to be signed in to add a renewal. Please log in and try again.',
        'UNAUTHENTICATED',
        401
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return apiError(
        "We couldn't read that request. Send the renewal as JSON in the request body.",
        'INVALID_JSON',
        400
      )
    }

    const parsed = createRenewalSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(
        'Some fields need a quick fix before we can save this renewal.',
        'VALIDATION_FAILED',
        400,
        zodFieldErrors(parsed.error)
      )
    }

    const entitlements = await getEntitlements(supabase, user.id)

    // Plan limit: Free tracks 5 renewals; Pro/Business are unlimited (null).
    if (entitlements.max_renewals !== null) {
      const trackedCount = await countTrackedRenewals(supabase, user.id)
      if (trackedCount >= entitlements.max_renewals) {
        return apiError(
          `You're tracking ${trackedCount} of ${entitlements.max_renewals} renewals on the ${entitlements.plan_name} plan. Upgrade to Pro for unlimited tracking.`,
          'PLAN_LIMIT_REACHED',
          403
        )
      }
    }

    // Alert windows: explicit input over the plan cap is an error the user can
    // fix; defaults from the profile are silently trimmed to the plan cap so a
    // free user is never blocked by our own smart defaults.
    let alertDaysBefore: number[]
    if (parsed.data.alert_days_before) {
      alertDaysBefore = normalizeAlertDays(parsed.data.alert_days_before)
      if (alertDaysBefore.length > entitlements.max_alert_windows) {
        return apiError(
          `The ${entitlements.plan_name} plan includes up to ${entitlements.max_alert_windows} alert windows per renewal. Trim the list or upgrade for more.`,
          'ALERT_WINDOW_LIMIT_REACHED',
          403,
          {
            alert_days_before: `Your plan supports up to ${entitlements.max_alert_windows} alert windows.`,
          }
        )
      }
    } else {
      const profile = await ensureProfile(supabase, user)
      const defaults = normalizeAlertDays(profile?.default_alert_days ?? [30, 7, 1])
      const fallback = defaults.length > 0 ? defaults : [30, 7, 1]
      alertDaysBefore = fallback.slice(0, Math.max(1, entitlements.max_alert_windows))
    }

    const renewal = await createRenewal(supabase, user.id, {
      vendor_name: parsed.data.vendor_name,
      vendor_url: parsed.data.vendor_url ?? null,
      category: parsed.data.category,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      billing_cycle: parsed.data.billing_cycle,
      next_renewal_date: parsed.data.next_renewal_date,
      auto_renews: parsed.data.auto_renews,
      cancel_notice_days: parsed.data.cancel_notice_days,
      alert_days_before: alertDaysBefore,
      notes: parsed.data.notes ?? null,
    })

    return apiSuccess({ renewal }, 201)
  } catch (error) {
    console.error('[api/renewals] POST failed:', error)
    return apiError(
      "We couldn't save that renewal just now. Please try again in a moment.",
      'INTERNAL_ERROR',
      500
    )
  }
}
