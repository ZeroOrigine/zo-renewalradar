// CANONICAL: /dashboard — the money-at-a-glance view. React Server Component:
// all data is fetched server-side through the RLS-scoped client via the
// service modules (never raw table access from the page).
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEntitlements } from '@/lib/db/entitlements'
import { countTrackedRenewals, getRenewalsSummary } from '@/lib/db/renewals'
import { daysLabel, formatDate, formatMoney } from '@/lib/core/format'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/dashboard')
  }

  const [summary, entitlements, trackedCount] = await Promise.all([
    getRenewalsSummary(supabase, user.id),
    getEntitlements(supabase, user.id),
    countTrackedRenewals(supabase, user.id),
  ])

  const planUsage =
    entitlements.max_renewals === null
      ? `${trackedCount} tracked · unlimited on ${entitlements.plan_name}`
      : `${trackedCount} of ${entitlements.max_renewals} on ${entitlements.plan_name}`

  if (trackedCount === 0) {
    return (
      <div className="card animate-rise mx-auto max-w-lg p-10 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-3xl" aria-hidden="true">📡</span>
        <h1 className="mt-5 text-2xl">Your radar is empty</h1>
        <p className="mt-2 text-sm text-slate-600">
          Add your first renewal — the one you're most afraid of forgetting. It takes about 20 seconds, and we'll compute the last safe day to cancel automatically.
        </p>
        <Link href="/renewals/new" className="btn-primary mt-6">Add your first renewal</Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <header className="animate-rise flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl">Your radar</h1>
          <p className="mt-1 text-sm text-slate-600">{planUsage}</p>
        </div>
        <Link href="/renewals/new" className="btn-primary self-start">Add renewal</Link>
      </header>

      <section aria-label="Spending overview" className="animate-rise-1 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Monthly cost</p>
          <p className="mt-2 font-display text-3xl font-extrabold text-slate-900">
            {formatMoney(summary.monthly_total, summary.primary_currency)}
          </p>
          {summary.totals_by_currency.length > 1 && (
            <p className="mt-1 text-xs text-slate-500">Largest currency shown; {summary.totals_by_currency.length} currencies tracked.</p>
          )}
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Annual projection</p>
          <p className="mt-2 font-display text-3xl font-extrabold text-slate-900">
            {formatMoney(summary.annual_projection, summary.primary_currency)}
          </p>
          {summary.custom_cycle_count > 0 && (
            <p className="mt-1 text-xs text-slate-500">{summary.custom_cycle_count} custom-cycle item(s) excluded to keep this honest.</p>
          )}
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active renewals</p>
          <p className="mt-2 font-display text-3xl font-extrabold text-slate-900">{summary.active_count}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Next up</p>
          {summary.next_renewal ? (
            <>
              <p className="mt-2 truncate text-lg font-bold text-slate-900">{summary.next_renewal.vendor_name}</p>
              <p className="mt-1 text-sm text-slate-600">
                {formatDate(summary.next_renewal.next_renewal_date)} ({daysLabel(summary.next_renewal.days_until_renewal)})
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-600">Nothing upcoming.</p>
          )}
        </div>
      </section>

      {summary.closing_cancel_windows.length > 0 && (
        <section aria-label="Cancel windows closing soon" className="animate-rise-2">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
            <h2 className="text-base font-bold text-rose-900">
              {summary.closing_cancel_windows.length === 1 ? '1 cancel window closes' : `${summary.closing_cancel_windows.length} cancel windows close`} within 7 days
            </h2>
            <ul className="mt-3 space-y-2">
              {summary.closing_cancel_windows.map((item) => (
                <li key={item.id}>
                  <Link href={`/renewals/${item.id}`} className="flex items-center justify-between gap-4 rounded-xl bg-white/70 px-4 py-3 transition-colors hover:bg-white">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{item.vendor_name}</p>
                      <p className="text-xs text-slate-600">{formatMoney(item.amount, item.currency)} · renews {formatDate(item.next_renewal_date)}</p>
                    </div>
                    <span className="whitespace-nowrap text-sm font-bold text-rose-700">
                      {item.days_until_cancel_deadline === 0 ? 'Cancel by today' : `Cancel ${daysLabel(item.days_until_cancel_deadline ?? 0)}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section aria-label="Upcoming renewals" className="animate-rise-3 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg">Next 30 days</h2>
          <Link href="/renewals" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">View all →</Link>
        </div>
        {summary.upcoming_renewals.length === 0 ? (
          <div className="card p-6 text-center text-sm text-slate-600">Nothing renews in the next 30 days. Enjoy the quiet.</div>
        ) : (
          <ul className="card divide-y divide-slate-100">
            {summary.upcoming_renewals.map((item) => (
              <li key={item.id}>
                <Link href={`/renewals/${item.id}`} className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.vendor_name}</p>
                    <p className="text-xs text-slate-500">{formatMoney(item.amount, item.currency)} · {item.billing_cycle.replace('_', ' ')}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${item.days_until_renewal <= 7 ? 'text-amber-600' : 'text-slate-700'}`}>
                      {daysLabel(item.days_until_renewal)}
                    </p>
                    <p className="text-xs text-slate-500">{formatDate(item.next_renewal_date)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
