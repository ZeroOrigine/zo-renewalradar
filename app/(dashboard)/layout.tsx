// CANONICAL: app/(dashboard)/layout.tsx — protected shell: brand, primary nav,
// sign-out. Middleware already guards these routes; the getUser() check here is
// defense in depth. Sign-out is a POST form (never an <a> to /api/*).
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/renewals', label: 'Renewals' },
  { href: '/billing', label: 'Billing' },
  { href: '/settings', label: 'Settings' },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5" aria-label="RenewalRadar dashboard">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                <circle cx="12" cy="12" r="8" opacity="0.4" />
                <circle cx="12" cy="12" r="4" opacity="0.7" />
                <path d="M12 12l5.5-5.5" strokeLinecap="round" />
              </svg>
            </span>
            <span className="hidden font-display text-lg font-bold tracking-tight text-slate-900 sm:block">RenewalRadar</span>
          </Link>

          <nav aria-label="Primary" className="flex items-center gap-1 overflow-x-auto">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex min-h-[44px] items-center whitespace-nowrap rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden max-w-[180px] truncate text-sm text-slate-500 md:block">{user.email}</span>
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="inline-flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  )
}
