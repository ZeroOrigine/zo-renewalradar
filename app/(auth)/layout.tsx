// CANONICAL: shared shell for all RenewalRadar auth pages (login/signup/forgot/reset).
// Server component. Renders the centered card chrome; pages render inside it.
// Inherits fonts + design tokens from the root layout (owned by the core step).
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'RenewalRadar — Your account',
  description:
    'Sign in to RenewalRadar and never get blindsided by an auto-renewal again.',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-brand-50 via-white to-brand-100">
      {/* Decorative radar rings — pure ornament, hidden from assistive tech */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.07]"
      >
        <svg
          className="h-[56rem] w-[56rem] text-brand-600"
          viewBox="0 0 400 400"
          fill="none"
          stroke="currentColor"
        >
          <circle cx="200" cy="200" r="70" strokeWidth="1" />
          <circle cx="200" cy="200" r="130" strokeWidth="1" />
          <circle cx="200" cy="200" r="198" strokeWidth="1" />
          <path d="M200 200 L340 60" strokeWidth="1" strokeLinecap="round" />
        </svg>
      </div>

      <header className="relative z-10 flex justify-center pt-10">
        <Link href="/" className="group inline-flex items-center gap-2.5" aria-label="RenewalRadar home">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/20 transition-transform group-hover:scale-105">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
              <circle cx="12" cy="12" r="9" opacity="0.35" />
              <circle cx="12" cy="12" r="5" opacity="0.6" />
              <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
              <path d="M12 12 L18.5 5.5" strokeLinecap="round" />
            </svg>
          </span>
          <span className="font-display text-xl font-bold tracking-tight text-gray-900">RenewalRadar</span>
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-start justify-center px-4 py-10 sm:items-center sm:py-12">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-xl shadow-brand-900/5 sm:p-10">
            {children}
          </div>
          <p className="mt-6 text-center text-sm text-gray-500">
            Never pay for a zombie subscription again.
          </p>
        </div>
      </main>

      <footer className="relative z-10 pb-8 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} RenewalRadar · Alerts before every renewal
      </footer>
    </div>
  )
}
