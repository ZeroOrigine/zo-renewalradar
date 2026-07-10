'use client'

// CANONICAL: RenewalRadar root error boundary — covers marketing and auth
// routes (the dashboard group has its own). Friendly recovery, no stack traces.

import Link from 'next/link'
import { useEffect } from 'react'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[root] page error:', error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl" aria-hidden="true">
          ⚡
        </span>
        <h1 className="mt-4 text-xl font-bold text-slate-900">Something tripped on our side</h1>
        <p className="mt-2 text-sm text-slate-600">
          Nothing you did — this page just hit a snag. Trying again usually sorts it out.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            Back home
          </Link>
        </div>
      </div>
    </div>
  )
}
