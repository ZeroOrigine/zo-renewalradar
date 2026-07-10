// CANONICAL: RenewalRadar browser Supabase client — the single source of truth
// for Supabase access from client components.
//
// Server components, server actions, and API route handlers must use
// lib/supabase/server.ts instead. Per pipeline lesson 3.1 this codebase uses
// ONLY @supabase/ssr — never @supabase/auth-helpers-nextjs (deprecated, and
// its cookie format is incompatible: it caused an infinite redirect loop in a
// previous product).

import { createBrowserClient } from '@supabase/ssr'

/**
 * Lazily creates a browser client. Environment variables are read at call
 * time (never at module load), so a missing variable can never crash the
 * Next.js build during prerendering.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase environment variables are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
