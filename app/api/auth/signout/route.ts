// CANONICAL: POST /api/auth/signout — CSRF-safe sign-out.
// POST-only (never a GET link — anchors to /api/* are forbidden by contract) with a
// same-origin check. Form posts get a 303 redirect home; fetch() calls get JSON.

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true // non-browser clients; the session cookie is still required upstream
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: { code: 'bad_origin', message: 'This request must come from the RenewalRadar app.' } },
      { status: 403 }
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (supabaseUrl && supabaseAnonKey) {
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
            // ignore
          }
        },
      },
    })
    await supabase.auth.signOut()
  }

  const wantsHtml = (request.headers.get('accept') ?? '').includes('text/html')
  if (wantsHtml) {
    return NextResponse.redirect(new URL('/', request.url), { status: 303 })
  }
  return NextResponse.json({ success: true })
}
