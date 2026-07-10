'use client'
// CANONICAL: /login — email/password + Google/GitHub OAuth sign-in.
// Everything is inline (inline-first architecture): OAuth buttons, error mapping,
// param handling. Honors the FLOW CONTRACT: ?plan=pro|business → /billing?intent=<plan>
// after sign-in; otherwise a validated ?next= path, else /dashboard.

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

// ---------------------------------------------------------------------------
// Lazy browser Supabase client (created on first interaction — never at module
// load, so prerendering can never crash on missing env vars).
// ---------------------------------------------------------------------------
let browserClient: ReturnType<typeof createBrowserClient> | null = null
function getSupabase() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return browserClient
}

function sanitizeNext(raw: string | null): string | null {
  if (!raw) return null
  if (!raw.startsWith('/')) return null
  if (raw.startsWith('//') || raw.startsWith('/\\')) return null
  return raw
}

function friendlyLoginError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials'))
    return "That email and password don't match. Try again, or reset your password below."
  if (m.includes('email not confirmed'))
    return "Your email isn't confirmed yet — check your inbox for the confirmation link."
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Too many attempts — give it a minute, then try again.'
  return "We couldn't sign you in just now. Give it another try in a moment."
}

const URL_ERROR_COPY: Record<string, string> = {
  link_expired: 'That link has expired or was already used. Sign in below, or request a fresh one.',
  oauth: "We couldn't finish signing you in with that provider. Try again, or use email instead.",
  auth: "That sign-in attempt didn't go through. Try again below.",
  config: "We're finishing some setup on our end. Email sign-in below still works.",
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a12.04 12.04 0 0 0 0 10.76l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.04-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .11-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22 0 1.61-.01 2.9-.01 3.29 0 .32.21.7.82.58A12 12 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const plan = useMemo(() => {
    const p = searchParams.get('plan')
    return p === 'pro' || p === 'business' ? p : null
  }, [searchParams])
  const next = useMemo(() => sanitizeNext(searchParams.get('next')), [searchParams])
  const destination = plan ? `/billing?intent=${plan}` : next ?? '/dashboard'
  const urlError = searchParams.get('error')

  const carried = useMemo(() => {
    const p = new URLSearchParams()
    if (plan) p.set('plan', plan)
    if (next) p.set('next', next)
    const s = p.toString()
    return s ? `?${s}` : ''
  }, [plan, next])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<null | 'google' | 'github'>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    const { error: signInError } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (signInError) {
      setLoading(false)
      setError(friendlyLoginError(signInError.message))
      return
    }
    router.push(destination)
    router.refresh()
  }

  async function handleOAuth(provider: 'google' | 'github') {
    if (oauthLoading) return
    setError(null)
    setOauthLoading(provider)
    const redirectTo = `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(destination)}`
    const { error: oauthError } = await getSupabase().auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    })
    if (oauthError) {
      setOauthLoading(null)
      setError("We couldn't reach that provider. Try again, or use email instead.")
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">Welcome back</h1>
      <p className="mt-1.5 text-sm text-gray-600">Sign in to see what's renewing next.</p>

      {urlError && URL_ERROR_COPY[urlError] && (
        <div role="alert" className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {URL_ERROR_COPY[urlError]}
        </div>
      )}

      {error && (
        <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => handleOAuth('google')}
          disabled={oauthLoading !== null || loading}
          className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {oauthLoading === 'google' ? <Spinner /> : <GoogleIcon />}
          Google
        </button>
        <button
          type="button"
          onClick={() => handleOAuth('github')}
          disabled={oauthLoading !== null || loading}
          className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {oauthLoading === 'github' ? <Spinner /> : <GitHubIcon />}
          GitHub
        </button>
      </div>

      <div className="my-6 flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">or with email</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 placeholder-gray-400 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <Link href="/forgot-password" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              Forgot password?
            </Link>
          </div>
          <div className="relative mt-1.5">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 pr-11 text-gray-900 placeholder-gray-400 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 transition hover:text-gray-600"
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                  <path d="M3 3l18 18M10.6 10.6a2.5 2.5 0 003.5 3.5M9.9 4.24A9.5 9.5 0 0121.5 12a15.3 15.3 0 01-2.2 3M6.6 6.6A15 15 0 002.5 12a9.5 9.5 0 0011.9 5.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                  <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="2.75" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || oauthLoading !== null}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Spinner />}
          {loading ? 'Signing you in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        New here?{' '}
        <Link href={`/signup${carried}`} className="font-semibold text-brand-600 hover:text-brand-700">
          Create your account
        </Link>
      </p>
    </div>
  )
}

function LoginSkeleton() {
  return (
    <div className="animate-pulse space-y-5" aria-hidden="true">
      <div className="h-7 w-2/5 rounded bg-gray-200" />
      <div className="h-4 w-3/5 rounded bg-gray-100" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-10 rounded-lg bg-gray-100" />
        <div className="h-10 rounded-lg bg-gray-100" />
      </div>
      <div className="h-10 rounded-lg bg-gray-100" />
      <div className="h-10 rounded-lg bg-gray-100" />
      <div className="h-10 rounded-lg bg-gray-200" />
    </div>
  )
}

// useSearchParams() MUST be wrapped in <Suspense> (Next.js prerender rule).
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  )
}
