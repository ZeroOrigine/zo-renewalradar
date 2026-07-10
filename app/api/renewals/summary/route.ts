// CANONICAL: /api/renewals/summary — the dashboard's money-at-a-glance
// payload: monthly burn, annual projection, upcoming charges, and the killer
// insight — cancel windows closing within 7 days. One call powers the entire
// first-3-seconds dashboard experience.

import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/db/api'
import { getEntitlements } from '@/lib/db/entitlements'
import { countTrackedRenewals, getRenewalsSummary } from '@/lib/db/renewals'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return apiError(
        'You need to be signed in to see your renewal summary. Please log in and try again.',
        'UNAUTHENTICATED',
        401
      )
    }

    const [summary, entitlements, trackedCount] = await Promise.all([
      getRenewalsSummary(supabase, user.id),
      getEntitlements(supabase, user.id),
      countTrackedRenewals(supabase, user.id),
    ])

    return apiSuccess({
      ...summary,
      plan: {
        slug: entitlements.plan_slug,
        name: entitlements.plan_name,
        max_renewals: entitlements.max_renewals,
        renewals_used: trackedCount,
        renewals_remaining:
          entitlements.max_renewals === null
            ? null
            : Math.max(0, entitlements.max_renewals - trackedCount),
        csv_export: entitlements.csv_export,
      },
    })
  } catch (error) {
    console.error('[api/renewals/summary] GET failed:', error)
    return apiError(
      'We hit a snag crunching your numbers. Please try again in a moment.',
      'INTERNAL_ERROR',
      500
    )
  }
}
