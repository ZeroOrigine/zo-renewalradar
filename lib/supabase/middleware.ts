// CANONICAL: RenewalRadar Supabase session refresh for Next.js middleware.
//
// The root middleware.ts (owned by the auth_payments step) imports
// updateSession() from here and layers its redirect rules on top. This is the
// ONLY place session-refresh cookie plumbing lives — one library
// (@supabase/ssr), one cookie format, zero redirect loops.
//
// NOTE for the middleware author: if you return your own redirect instead of
// the response returned here, copy the refreshed auth cookies across first:
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
