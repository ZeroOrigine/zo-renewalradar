'use client'
// CANONICAL: /forgot-password — sends a Supabase password-recovery email.
// The email link lands on /auth/confirm, which verifies the token and forwards
// the user to /reset-password with an authenticated recovery session.
// No useSearchParams here → no Suspense boundary required.

import { useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

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

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    const redirectTo = `${window.location.origin}/auth/confirm?next=${encodeURIComponent('/reset-password')}`
    const { error: resetError } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    })
    setLoading(false)
    if (resetError && /rate limit|too many/i.test(resetError.message)) {
      setError('Too many requests — give it a minute, then try again.')
      return
    }
    // For any other outcome we show success — never confirm whether an email
    // exists (user-enumeration protection).
    setSentTo(email.trim())
  }

  if (sentTo) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 ring-8 ring-brand-50">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7 text-brand-600" aria-hidden="true">
            <path d="M3 8l7.9 5.3a2 2 0 002.2 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-gray-900">On its way</h1>
        <p className="mt-2 text-sm text-gray-600">
          If an account exists for <span className="font-semibold text-gray-900">{sentTo}</span>, a reset link is
          heading to that inbox now. It expires in about an hour.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 active:scale-[0.98]"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">Reset your password</h1>
      <p className="mt-1.5 text-sm text-gray-600">
        Tell us your email and we'll send you a link to set a new one.
      </p>

      {error && (
        <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Spinner />}
          {loading ? 'Sending the link…' : 'Send reset link'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Remembered it?{' '}
        <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </div>
  )
}
