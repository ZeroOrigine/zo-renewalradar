// CANONICAL: RenewalRadar server-side Supabase clients — the single source of
// truth for Supabase access from server components, server actions, and API
// route handlers.
//
//   createClient()            -> cookie-scoped client (RLS enforced). Use this
//                                everywhere a user is acting.
//   createServiceRoleClient() -> RLS-BYPASSING admin client. Server-only.
//                                Intended importers: the Stripe webhook handler
//                                (owned by the auth_payments step) and scheduled
//                                jobs. NEVER import from a client component.
//
// Per pipeline lesson 3.1: @supabase/ssr is the ONLY auth client library in
// this codebase. Do not add @supabase/auth-helpers-nextjs anywhere.
// Per builder rule 4.1: all initialization is lazy — no module-level throws,
// so missing env vars can never crash the Netlify build.

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cookie-scoped Supabase client for the current request. Respects Row Level
 * Security, so every query is automatically limited to the signed-in user.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase environment variables are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }

  const cookieStore = cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // cookies() is read-only inside Server Components. Session refresh is
          // handled by middleware (lib/supabase/middleware.ts), so swallowing
          // this is safe by design.
        }
      },
    },
  })
}

let cachedServiceRoleClient: SupabaseClient | null = null

/**
 * Service-role client that bypasses RLS. Lazily created and cached per server
 * instance. Only ever call this from trusted server code (webhooks, cron).
 */
export function createServiceRoleClient(): SupabaseClient {
  if (cachedServiceRoleClient) {
    return cachedServiceRoleClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Supabase service-role environment variables are missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    )
  }

  cachedServiceRoleClient = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return cachedServiceRoleClient
}
