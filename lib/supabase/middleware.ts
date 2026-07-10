// CANONICAL: RenewalRadar Supabase session-refresh helper for Next.js middleware.
//
// PATCH v2 (self-validation, honesty fix): the previous header claimed the root
// middleware.ts imports updateSession() from here. It does NOT — the root
// middleware (owned by the auth_payments step) implements this exact
// @supabase/ssr cookie pattern inline, because its redirect rules are
// interleaved with cookie propagation and refactoring them through this helper
// risks the redirect-loop bug class this codebase specifically guards against.
//
// This module is retained as the canonical, reusable session-refresh helper
// (same library, same cookie format, zero drift) for any future middleware or
// edge consumer. If you adopt it, remember: when returning your own redirect
// instead of the response returned here, copy the refreshed auth cookies first:
//   const redirect = NextResponse.redirect(url)
//   response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'

export interface UpdateSessionResult {
  response: NextResponse
  user: User | null
}

export async function updateSession(request: NextRequest): Promise<UpdateSessionResult> {
  let supabaseResponse = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // Misconfigured environment: fail open for public pages instead of
    // crashing every request. Protected routes still bounce to login because
    // user resolves to null.
    return { response: supabaseResponse, user: null }
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })
        supabaseResponse = NextResponse.next({
          request: { headers: request.headers },
        })
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options)
        })
      },
    },
  })

  // getUser() validates the JWT against the auth server — never trust
  // getSession() alone in server code.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response: supabaseResponse, user }
}
