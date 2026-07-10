// CANONICAL: RenewalRadar 404 page.
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="font-display text-5xl font-extrabold text-indigo-600">404</p>
        <h1 className="mt-3 text-xl font-bold text-slate-900">Off the radar</h1>
        <p className="mt-2 text-sm text-slate-600">That page doesn't exist — but your renewals are exactly where you left them.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/dashboard" className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500">
            Go to dashboard
          </Link>
          <Link href="/" className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
            Back home
          </Link>
        </div>
      </div>
    </div>
  )
}
