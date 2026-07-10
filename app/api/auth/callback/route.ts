// CANONICAL: GET /api/auth/callback — OAuth (Google/GitHub) + PKCE code exchange.
// This file gates all OAuth logins. It MUST: exchange the code, handle provider
// errors, and honor the validated `next` redirect param (FLOW CONTRACT:
// /billing?intent=<plan> survives the whole OAuth round-trip).
// Middleware exempts /api/auth/* — no session exists yet when this runs.

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

function sanitizeNext(raw: string | null, fallback: string): string {
  if (!raw) return fallback
  if (!raw.startsWith('/')) return fallback
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  return raw
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const providerError = url.searchParams.get('error')
  const next = sanitizeNext(url.searchParams.get('next'), '/dashboard')

  // The provider (or the user) declined — send them back with friendly copy.
  if (providerError) {
    console.error('[auth/callback] provider error:', providerError, url.searchParams.get('error_description'))
    return NextResponse.redirect(new URL('/login?error=oauth', request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=auth', request.url))
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[auth/callback] Supabase env vars missing.')
    return NextResponse.redirect(new URL('/login?error=config', request.url))
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Safe to ignore; middleware refresh will repair state on next request.
        }
      },
    },
  })

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('[auth/callback] exchangeCodeForSession failed:', error.message)
    return NextResponse.redirect(new URL('/login?error=auth', request.url))
  }

  return NextResponse.redirect(new URL(next, request.url))
}
