'use client'

// CANONICAL: dashboard-group error boundary (root error.tsx explicitly defers
// dashboard routes to this file). Friendly recovery, no stack traces.

import Link from 'next/link'
import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[dashboard] page error:', error)
  }, [error])

  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl" aria-hidden="true">⚡</span>
      <h1 className="mt-4 text-xl">Something tripped on our side</h1>
      <p className="mt-2 text-sm text-slate-600">Your renewals are safe — this view just hit a snag. Trying again usually sorts it out.</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button type="button" onClick={reset} className="btn-primary">Try again</button>
        <Link href="/dashboard" className="btn-secondary">Go to dashboard</Link>
      </div>
    </div>
  )
}
