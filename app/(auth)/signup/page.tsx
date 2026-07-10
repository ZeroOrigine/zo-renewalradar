'use client'
// CANONICAL: /signup — registration with email confirmation + OAuth.
// FLOW CONTRACT (critical, ecosystem-learned): reads ?plan=pro|business and ?next=,
// persists the intent through the email-confirmation chain via emailRedirectTo
// (`/auth/confirm?next=/billing?intent=<plan>`) AND in user metadata (plan_intent),
// so the upgrade resumes automatically after the first session exists.

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { PLANS, formatPrice } from '@/lib/stripe/config'

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

function friendlySignupError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'You already have an account with this email — sign in instead (link below).'
  if (m.includes('password'))
    return 'That password is too weak. Use at least 8 characters — a short phrase works great.'
  if (m.includes('rate limit') || m.includes('too many'))
    return "Too many attempts — give it a minute, then try again."
  if (m.includes('invalid') && m.includes('email'))
    return "Hmm, that email doesn't look quite right. Mind checking it?"
  return "We couldn't create your account just now. Give it another try in a moment."
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

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const plan = useMemo(() => {
    const p = searchParams.get('plan')
    return p === 'pro' || p === 'business' ? p : null
  }, [searchParams])
  const next = useMemo(() => sanitizeNext(searchParams.get('next')), [searchParams])
  const destination = plan ? `/billing?intent=${plan}` : next ?? '/dashboard'

  const carried = useMemo(() => {
    const p = new URLSearchParams()
    if (plan) p.set('plan', plan)
    if (next) p.set('next', next)
    const s = p.toString()
    return s ? `?${s}` : ''
  }, [plan, next])

  const planInfo = plan ? PLANS[plan] : null

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<null | 'google' | 'github'>(null)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  function confirmRedirect() {
    return `${window.location.origin}/auth/confirm?next=${encodeURIComponent(destination)}`
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    setError(null)
    if (password.length < 8) {
      setError('Your password needs at least 8 characters — a short phrase works great.')
      return
    }
    setLoading(true)
    const { data, error: signUpError } = await getSupabase().auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: confirmRedirect(),
        data: {
          full_name: fullName.trim() || undefined,
          plan_intent: plan ?? undefined,
        },
      },
    })
    setLoading(false)
    if (signUpError) {
      setError(friendlySignupError(signUpError.message))
      return
    }
    // Email confirmations disabled → session exists → straight to value.
    if (data.session) {
      router.push(destination)
      router.refresh()
      return
    }
    // Supabase returns a user with zero identities when the email is already taken.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError('You already have an account with this email — sign in instead (link below).')
      return
    }
    setSentTo(email.trim())
  }

  async function handleResend() {
    if (!sentTo || resending) return
    setResending(true)
    await getSupabase().auth.resend({
      type: 'signup',
      email: sentTo,
      options: { emailRedirectTo: confirmRedirect() },
    })
    setResending(false)
    setResent(true)
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

  // -------------------------------------------------------------------------
  // "Check your inbox" state — celebratory, informative, with a clear next step.
  // -------------------------------------------------------------------------
  if (sentTo) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 ring-8 ring-green-50">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-7 w-7 text-green-600" aria-hidden="true">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-gray-900">Check your inbox!</h1>
        <p className="mt-2 text-sm text-gray-600">
          You're one click away. We sent a confirmation link to{' '}
          <span className="font-semibold text-gray-900">{sentTo}</span>.
        </p>
        {planInfo && (
          <p className="mt-2 text-sm text-brand-700">
            After you confirm, we'll take you straight to {planInfo.name} checkout — {formatPrice(planInfo.priceMonthlyCents)}/mo.
          </p>
        )}
        <p className="mt-4 text-xs text-gray-500">Not seeing it? Check spam, or resend below.</p>
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || resent}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resending && <Spinner />}
            {resent ? 'Sent! Check your inbox.' : resending ? 'Resending…' : 'Resend the link'}
          </button>
          <button
            type="button"
            onClick={() => {
              setSentTo(null)
              setResent(false)
            }}
            className="w-full text-sm font-medium text-gray-500 transition hover:text-gray-700"
          >
            Wrong address? Start over
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">Create your account</h1>
      <p className="mt-1.5 text-sm text-gray-600">Your renewal radar goes live in about a minute.</p>

      {planInfo && (
        <div className="mt-5 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          You picked <span className="font-semibold">{planInfo.name}</span> —{' '}
          {formatPrice(planInfo.priceMonthlyCents)}/mo or {formatPrice(planInfo.priceYearlyCents)}/yr. Create your
          account and we'll take you straight to checkout.
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
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
            Name <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ada Lovelace"
            className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 placeholder-gray-400 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />
        </div>

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
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <div className="relative mt-1.5">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8+ characters"
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
          {loading ? 'Creating your account…' : planInfo ? `Create account & continue to ${planInfo.name}` : 'Create my account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Already tracking renewals?{' '}
        <Link href={`/login${carried}`} className="font-semibold text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </div>
  )
}

function SignupSkeleton() {
  return (
    <div className="animate-pulse space-y-5" aria-hidden="true">
      <div className="h-7 w-3/5 rounded bg-gray-200" />
      <div className="h-4 w-4/5 rounded bg-gray-100" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-10 rounded-lg bg-gray-100" />
        <div className="h-10 rounded-lg bg-gray-100" />
      </div>
      <div className="h-10 rounded-lg bg-gray-100" />
      <div className="h-10 rounded-lg bg-gray-100" />
      <div className="h-10 rounded-lg bg-gray-100" />
      <div className="h-10 rounded-lg bg-gray-200" />
    </div>
  )
}

// useSearchParams() MUST be wrapped in <Suspense> (Next.js prerender rule).
export default function SignupPage() {
  return (
    <Suspense fallback={<SignupSkeleton />}>
      <SignupForm />
    </Suspense>
  )
}
