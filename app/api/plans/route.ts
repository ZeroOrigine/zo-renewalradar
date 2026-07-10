// CANONICAL: /api/plans — public pricing catalog. Anonymous-readable (RLS
// exposes active plans to anon), so the pricing page and upgrade prompts can
// render live prices. Stripe price IDs are included: they are public
// identifiers and the checkout route (auth_payments step) consumes them.

import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/db/api'

export const dynamic = 'force-dynamic'

// Explicit columns — never select('*').
const PLAN_COLUMNS =
  'slug, name, description, price_monthly_cents, price_yearly_cents, stripe_price_id_monthly, stripe_price_id_yearly, max_renewals, features, sort_order'

export async function GET() {
  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('renewalradar_plans')
      .select(PLAN_COLUMNS)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(20)

    if (error) {
      throw error
    }

    return apiSuccess({ plans: data ?? [] })
  } catch (error) {
    console.error('[api/plans] GET failed:', error)
    return apiError(
      "We couldn't load the plans just now. Please try again in a moment.",
      'INTERNAL_ERROR',
      500
    )
  }
}
