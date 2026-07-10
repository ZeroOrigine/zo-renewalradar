// CANONICAL: RenewalRadar middleware — session refresh + route protection for the whole app.
// PATCH v3 (self-validation):
//  1. /api/cron added to OPEN_API_PREFIXES — the alert dispatcher authenticates
//     with a CRON_SECRET bearer token, not a session.
//  2. Unauthenticated /api JSON 401 now uses the FLAT api envelope
//     ({ data, error, code }) so api-step clients that render `json.error`
//     directly never see "[object Object]" on an expired session.
//     (billing-client reads error?.message and gracefully falls back.)

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PAGE_PREFIXES = [
  '/dashboard',
  '/billing',
  '/settings',
  '/account',
  '/renewals',
  '/onboarding',
]

// /reset-password intentionally NOT here — the recovery session must reach it.
const AUTH_PAGES = ['/login', '/signup', '/forgot-password']

// Open API prefixes:
//  - /api/webhooks : Stripe authenticates with a signature, not a session.
//  - /api/auth     : the OAuth/PKCE callback runs BEFORE a session exists.
//  - /api/plans    : public pricing catalog (anon SELECT via RLS on active plans).
//  - /api/cron     : scheduled jobs authenticate with CRON_SECRET bearer token.
const OPEN_API_PREFIXES = ['/api/webhooks', '/api/auth', '/api/plans', '/api/cron']

function sanitizeNext(raw: string | null): string | null {
  if (!raw) return null
  if (!raw.startsWith('/')) return null
  if (raw.startsWith('//') || raw.startsWith('/\\')) return null
  return raw
}

export async function middleware(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl

  if (OPEN_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[middleware] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing — auth checks skipped.')
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const redirectWithCookies = (to: URL) => {
    const redirect = NextResponse.redirect(to)
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }

  const isApi = pathname === '/api' || pathname.startsWith('/api/')
  const isProtectedPage = PROTECTED_PAGE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )
  const isAuthPage = AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(p + '/'))

  if (!user && isApi) {
    const wantsHtml =
      request.method === 'GET' && (request.headers.get('accept') ?? '').includes('text/html')
    if (wantsHtml) {
      const login = new URL('/login', request.url)
      login.searchParams.set('next', pathname + search)
      return redirectWithCookies(login)
    }
    return NextResponse.json(
      { data: null, error: 'Please sign in to continue.', code: 'UNAUTHENTICATED' },
      { status: 401 }
    )
  }

  if (!user && isProtectedPage) {
    const login = new URL('/login', request.url)
    login.searchParams.set('next', pathname + search)
    return redirectWithCookies(login)
  }

  if (user && isAuthPage) {
    const plan = searchParams.get('plan')
    const next = sanitizeNext(searchParams.get('next'))
    const destination =
      plan === 'pro' || plan === 'business' ? `/billing?intent=${plan}` : next ?? '/dashboard'
    return redirectWithCookies(new URL(destination, request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff2?)$).*)',
  ],
}
