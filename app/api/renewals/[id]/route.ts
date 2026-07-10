// CANONICAL: /api/renewals/[id] — read (GET), update (PATCH), and delete
// (DELETE) a single renewal. Ownership is enforced by RLS plus explicit
// user_id checks (defense in depth). All responses use the shared envelope.

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess, zodFieldErrors } from '@/lib/db/api'
import { getEntitlements } from '@/lib/db/entitlements'
import {
  deleteRenewal,
  getRenewalById,
  normalizeAlertDays,
  updateRenewal,
  type UpdateRenewalInput,
} from '@/lib/db/renewals'
import { BILLING_CYCLES, RENEWAL_CATEGORIES, RENEWAL_STATUSES } from '@/lib/db/types'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: { id: string }
}

const renewalIdSchema = z.string().uuid()

// ---------------------------------------------------------------------------
// Validation (inline Zod schemas — all fields optional for PATCH)
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
    .number({ invalid_type_error: 'Amount should be a number, like 49.99.' })
    .min(0, "Amount can't be negative.")
    .max(9_999_999_999.99, 'That amount is larger than we can track.')
)

const currencyField = z
  .string({ invalid_type_error: 'Use a 3-letter currency code, like USD.' })
  .trim()
  .regex(/^[A-Za-z]{3}$/, 'Use a 3-letter currency code, like USD or EUR.')
  .transform((value) => value.toUpperCase())

const renewalDateField = z
  .string({ invalid_type_error: 'Send the date as YYYY-MM-DD, like 2026-07-01.' })
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

const updateRenewalSchema = z.object({
  vendor_name: z
    .string({ invalid_type_error: 'Vendor name should be text.' })
    .trim()
    .min(1, "Vendor name can't be empty.")
    .max(200, 'Vendor names max out at 200 characters.')
    .optional(),
  vendor_url: vendorUrlField,
  category: z
    .enum(RENEWAL_CATEGORIES, {
      errorMap: () => ({ message: `Pick one of: ${RENEWAL_CATEGORIES.join(', ')}.` }),
    })
    .optional(),
  amount: amountField.optional(),
  currency: currencyField.optional(),
  billing_cycle: z
    .enum(BILLING_CYCLES, {
      errorMap: () => ({ message: `Pick one of: ${BILLING_CYCLES.join(', ')}.` }),
    })
    .optional(),
  next_renewal_date: renewalDateField.optional(),
  auto_renews: z
    .boolean({ invalid_type_error: 'auto_renews should be true or false.' })
    .optional(),
  cancel_notice_days: z
    .preprocess(
      numberFromString,
      z
        .number({ invalid_type_error: 'Cancellation notice should be a number of days, like 30.' })
        .int('Cancellation notice should be a whole number of days.')
        .min(0, "Cancellation notice can't be negative.")
        .max(365, 'Cancellation notice maxes out at 365 days.')
    )
    .optional(),
  status: z
    .enum(RENEWAL_STATUSES, {
      errorMap: () => ({ message: `Status must be one of: ${RENEWAL_STATUSES.join(', ')}.` }),
    })
    .optional(),
  alert_days_before: alertDaysField.optional(),
  notes: z.preprocess(
    emptyStringToNull,
    z.string().trim().max(2000, 'Notes max out at 2,000 characters.').nullish()
  ),
})

// ---------------------------------------------------------------------------
// GET /api/renewals/[id]
// ---------------------------------------------------------------------------

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const parsedId = renewalIdSchema.safeParse(context.params.id)
    if (!parsedId.success) {
      return apiError(
        "That renewal ID doesn't look right. Refresh the page and try again.",
        'INVALID_ID',
        400
      )
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return apiError(
        'You need to be signed in to view this renewal. Please log in and try again.',
        'UNAUTHENTICATED',
        401
      )
    }

    const renewal = await getRenewalById(supabase, user.id, parsedId.data)
    if (!renewal) {
      return apiError(
        "We couldn't find that renewal. It may have been deleted.",
        'RENEWAL_NOT_FOUND',
        404
      )
    }

    return apiSuccess({ renewal })
  } catch (error) {
    console.error('[api/renewals/[id]] GET failed:', error)
    return apiError(
      'We hit a snag loading that renewal. Please try again in a moment.',
      'INTERNAL_ERROR',
      500
    )
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/renewals/[id]
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const parsedId = renewalIdSchema.safeParse(context.params.id)
    if (!parsedId.success) {
      return apiError(
        "That renewal ID doesn't look right. Refresh the page and try again.",
        'INVALID_ID',
        400
      )
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return apiError(
        'You need to be signed in to update a renewal. Please log in and try again.',
        'UNAUTHENTICATED',
        401
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return apiError(
        "We couldn't read that request. Send the changes as JSON in the request body.",
        'INVALID_JSON',
        400
      )
    }

    const parsed = updateRenewalSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(
        'Some fields need a quick fix before we can save your changes.',
        'VALIDATION_FAILED',
        400,
        zodFieldErrors(parsed.error)
      )
    }

    const value = parsed.data
    const patch: UpdateRenewalInput = {}

    if (value.vendor_name !== undefined) patch.vendor_name = value.vendor_name
    if (value.vendor_url !== undefined) patch.vendor_url = value.vendor_url
    if (value.category !== undefined) patch.category = value.category
    if (value.amount !== undefined) patch.amount = value.amount
    if (value.currency !== undefined) patch.currency = value.currency
    if (value.billing_cycle !== undefined) patch.billing_cycle = value.billing_cycle
    if (value.next_renewal_date !== undefined) patch.next_renewal_date = value.next_renewal_date
    if (value.auto_renews !== undefined) patch.auto_renews = value.auto_renews
    if (value.cancel_notice_days !== undefined) patch.cancel_notice_days = value.cancel_notice_days
    if (value.status !== undefined) patch.status = value.status
    if (value.notes !== undefined) patch.notes = value.notes

    if (value.alert_days_before !== undefined) {
      const normalized = normalizeAlertDays(value.alert_days_before)
      const entitlements = await getEntitlements(supabase, user.id)
      if (normalized.length > entitlements.max_alert_windows) {
        return apiError(
          `The ${entitlements.plan_name} plan includes up to ${entitlements.max_alert_windows} alert windows per renewal. Trim the list or upgrade for more.`,
          'ALERT_WINDOW_LIMIT_REACHED',
          403,
          {
            alert_days_before: `Your plan supports up to ${entitlements.max_alert_windows} alert windows.`,
          }
        )
      }
      patch.alert_days_before = normalized.length > 0 ? normalized : [30, 7, 1]
    }

    if (Object.keys(patch).length === 0) {
      return apiError(
        'Send at least one field to update — nothing changed.',
        'NOTHING_TO_UPDATE',
        400
      )
    }

    const renewal = await updateRenewal(supabase, user.id, parsedId.data, patch)
    if (!renewal) {
      return apiError(
        "We couldn't find that renewal. It may have been deleted.",
        'RENEWAL_NOT_FOUND',
        404
      )
    }

    return apiSuccess({ renewal })
  } catch (error) {
    console.error('[api/renewals/[id]] PATCH failed:', error)
    return apiError(
      "We couldn't save your changes just now. Please try again in a moment.",
      'INTERNAL_ERROR',
      500
    )
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/renewals/[id]
// ---------------------------------------------------------------------------

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const parsedId = renewalIdSchema.safeParse(context.params.id)
    if (!parsedId.success) {
      return apiError(
        "That renewal ID doesn't look right. Refresh the page and try again.",
        'INVALID_ID',
        400
      )
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return apiError(
        'You need to be signed in to delete a renewal. Please log in and try again.',
        'UNAUTHENTICATED',
        401
      )
    }

    const deleted = await deleteRenewal(supabase, user.id, parsedId.data)
    if (!deleted) {
      return apiError(
        "We couldn't find that renewal. It may already be deleted.",
        'RENEWAL_NOT_FOUND',
        404
      )
    }

    return apiSuccess({ id: parsedId.data, deleted: true })
  } catch (error) {
    console.error('[api/renewals/[id]] DELETE failed:', error)
    return apiError(
      "We couldn't delete that renewal just now. Please try again in a moment.",
      'INTERNAL_ERROR',
      500
    )
  }
}
