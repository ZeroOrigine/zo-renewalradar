// CANONICAL: /api/profile — read (GET) and update (PATCH) the signed-in
// user's RenewalRadar profile (name, currency, timezone, default alert
// windows, onboarding flag). Only columns the authenticated role is GRANTed
// to update are ever sent to Postgres.

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess, zodFieldErrors } from '@/lib/db/api'
import { ensureProfile, updateProfile, type ProfileUpdateInput } from '@/lib/db/profiles'
import { normalizeAlertDays } from '@/lib/db/renewals'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Validation (inline Zod schema with human error messages)
// ---------------------------------------------------------------------------

const emptyStringToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

const updateProfileSchema = z.object({
  full_name: z.preprocess(
    emptyStringToNull,
    z
      .string({ invalid_type_error: 'Your name should be text.' })
      .trim()
      .min(1, "Names can't be just spaces.")
      .max(120, 'Names max out at 120 characters.')
      .nullish()
  ),
  avatar_url: z.preprocess(
    emptyStringToNull,
    z
      .string()
      .trim()
      .url("That avatar URL doesn't look right — include https:// at the start.")
      .max(2048, 'URLs max out at 2,048 characters.')
      .nullish()
  ),
  default_currency: z
    .string({ invalid_type_error: 'Use a 3-letter currency code, like USD.' })
    .trim()
    .regex(/^[A-Za-z]{3}$/, 'Use a 3-letter currency code, like USD or EUR.')
    .transform((value) => value.toUpperCase())
    .optional(),
  timezone: z
    .string({ invalid_type_error: 'Send your timezone as an IANA name, like America/New_York.' })
    .trim()
    .min(1, 'Send your timezone as an IANA name, like America/New_York.')
    .max(64, 'Timezone names max out at 64 characters.')
    .refine(
      isValidTimezone,
      "We don't recognize that timezone. Use an IANA name, like America/New_York or Europe/Berlin."
    )
    .optional(),
  default_alert_days: z
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
    .optional(),
  onboarding_completed: z
    .boolean({ invalid_type_error: 'onboarding_completed should be true or false.' })
    .optional(),
})

// ---------------------------------------------------------------------------
// GET /api/profile
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return apiError(
        'You need to be signed in to view your profile. Please log in and try again.',
        'UNAUTHENTICATED',
        401
      )
    }

    // Self-heals if the signup trigger ever missed this user.
    const profile = await ensureProfile(supabase, user)
    if (!profile) {
      return apiError(
        "We couldn't find your profile. Try signing out and back in.",
        'PROFILE_NOT_FOUND',
        404
      )
    }

    return apiSuccess({ profile })
  } catch (error) {
    console.error('[api/profile] GET failed:', error)
    return apiError(
      'We hit a snag loading your profile. Please try again in a moment.',
      'INTERNAL_ERROR',
      500
    )
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/profile
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return apiError(
        'You need to be signed in to update your profile. Please log in and try again.',
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

    const parsed = updateProfileSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(
        'Some fields need a quick fix before we can save your profile.',
        'VALIDATION_FAILED',
        400,
        zodFieldErrors(parsed.error)
      )
    }

    const patch: ProfileUpdateInput = {}
    if (parsed.data.full_name !== undefined) patch.full_name = parsed.data.full_name
    if (parsed.data.avatar_url !== undefined) patch.avatar_url = parsed.data.avatar_url
    if (parsed.data.default_currency !== undefined)
      patch.default_currency = parsed.data.default_currency
    if (parsed.data.timezone !== undefined) patch.timezone = parsed.data.timezone
    if (parsed.data.default_alert_days !== undefined) {
      const normalized = normalizeAlertDays(parsed.data.default_alert_days)
      patch.default_alert_days = normalized.length > 0 ? normalized : [30, 7, 1]
    }
    if (parsed.data.onboarding_completed !== undefined)
      patch.onboarding_completed = parsed.data.onboarding_completed

    if (Object.keys(patch).length === 0) {
      return apiError(
        'Send at least one field to update — nothing changed.',
        'NOTHING_TO_UPDATE',
        400
      )
    }

    // Make sure the row exists before updating (self-heals a missed trigger).
    await ensureProfile(supabase, user)

    const profile = await updateProfile(supabase, user.id, patch)
    if (!profile) {
      return apiError(
        "We couldn't find your profile. Try signing out and back in.",
        'PROFILE_NOT_FOUND',
        404
      )
    }

    return apiSuccess({ profile })
  } catch (error) {
    console.error('[api/profile] PATCH failed:', error)
    return apiError(
      "We couldn't save your profile just now. Please try again in a moment.",
      'INTERNAL_ERROR',
      500
    )
  }
}
