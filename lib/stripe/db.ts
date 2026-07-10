// CANONICAL: service-role database access for Stripe billing modules ONLY.
// renewalradar_subscriptions and renewalradar_payments have NO client write policies —
// by design, only this service-role client (used from webhook/checkout server code)
// may mutate billing state. RLS is bypassed here, so NOTHING in this module may ever
// be imported from client components. Server-only. Lazy init — build-safe.
//
// NOTE: this is deliberately NOT an auth client. All cookie/session auth flows use
// @supabase/ssr exclusively (lib/supabase/* is owned by the api step).

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _admin: SupabaseClient | null = null

export function getBillingDb(): SupabaseClient {
  if (_admin) return _admin
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      'Billing database is not configured — NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (service key is server-only).'
    )
  }
  _admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _admin
}
