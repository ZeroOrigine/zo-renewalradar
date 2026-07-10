// CANONICAL: GET /auth/confirm — the single email-link handler for RenewalRadar.
// Handles BOTH Supabase email formats so it works no matter how templates are set up:
//   1. token_hash + type  (custom email templates)          → verifyOtp()
//   2. code               (default templates / PKCE flow)    → exchangeCodeForSession()
// Carries the FLOW CONTRACT `next` param (e.g. /billing?intent=pro) through to the app.
// Recovery links default to /reset-password. Failures land on /login?error=link_expired
// with friendly copy — never a raw error page.

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { EmailOtpType } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function sanitizeNext(raw: string | null, fallback: string): string {
  if (!raw) return fallback
  if (!raw.startsWith('/')) return fallback
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  return raw
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const code = url.searchParams.get('code')
  const fallbackNext = type === 'recovery' ? '/reset-password' : '/dashboard'
  const next = sanitizeNext(url.searchParams.get('next'), fallbackNext)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[auth/confirm] Supabase env vars missing.')
    return NextResponse.redirect(new URL('/login?error=config', request.url))
  }

  // Route handlers may write cookies — this is where the session gets minted.
  const cookieStore = await cookies()
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Cookie writes can throw outside a request scope; safe to ignore here.
        }
      },
    },
  })

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
    console.error('[auth/confirm] verifyOtp failed:', error.message)
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
    console.error('[auth/confirm] code exchange failed:', error.message)
  }

  return NextResponse.redirect(new URL('/login?error=link_expired', request.url))
}
