// CANONICAL: /renewals — paginated, filterable list of every renewal.
// React Server Component: data fetched server-side through the RLS-scoped
// service module. Filters and pagination are plain links (zero client JS).
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listRenewals } from '@/lib/db/renewals'
import { RENEWAL_STATUSES, type RenewalStatus } from '@/lib/db/types'
import { daysLabel, daysUntil, formatDate, formatMoney } from '@/lib/core/format'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

const STATUS_CHIP: Record<RenewalStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  paused: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  canceled: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200',
  expired: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200',
}

interface RenewalsPageProps {
  searchParams: { page?: string; status?: string }
}

function buildHref(page: number, status?: RenewalStatus): string {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (page > 1) params.set('page', String(page))
  const query = params.toString()
  return query ? `/renewals?${query}` : '/renewals'
}

export default async function RenewalsPage({ searchParams }: RenewalsPageProps) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/renewals')
  }

  const status = (RENEWAL_STATUSES as readonly string[]).includes(searchParams.status ?? '')
    ? (searchParams.status as RenewalStatus)
    : undefined
  const parsedPage = Number.parseInt(searchParams.page ?? '', 10)
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1
  const from = (page - 1) * PAGE_SIZE

  const { renewals, total } = await listRenewals(supabase, user.id, {
    from,
    to: from + PAGE_SIZE - 1,
    status,
  })
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <header className="animate-rise flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl">Renewals</h1>
          <p className="mt-1 text-sm text-slate-600">{total} {status ? status : 'total'} renewal{total === 1 ? '' : 's'} on your radar.</p>
        </div>
        <Link href="/renewals/new" className="btn-primary self-start">Add renewal</Link>
      </header>

      <nav aria-label="Filter by status" className="animate-rise-1 flex flex-wrap gap-2">
        <Link
          href={buildHref(1)}
          aria-current={!status ? 'page' : undefined}
          className={`inline-flex min-h-[44px] items-center rounded-full border px-4 text-sm font-medium transition-colors ${!status ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'}`}
        >
          All
        </Link>
        {RENEWAL_STATUSES.map((option) => (
          <Link
            key={option}
            href={buildHref(1, option)}
            aria-current={status === option ? 'page' : undefined}
            className={`inline-flex min-h-[44px] items-center rounded-full border px-4 text-sm font-medium capitalize transition-colors ${status === option ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'}`}
          >
            {option}
          </Link>
        ))}
      </nav>

      {renewals.length === 0 ? (
        <div className="card animate-rise-2 p-10 text-center">
          <p className="font-medium text-slate-900">{status ? `No ${status} renewals.` : 'Nothing here yet.'}</p>
          <p className="mt-1 text-sm text-slate-600">Add a renewal and we'll watch its deadline for you.</p>
          <Link href="/renewals/new" className="btn-primary mt-5">Add renewal</Link>
        </div>
      ) : (
        <ul className="card animate-rise-2 divide-y divide-slate-100">
          {renewals.map((renewal) => {
            const days = daysUntil(renewal.next_renewal_date)
            const cancelDays =
              renewal.status === 'active' && renewal.auto_renews && renewal.cancel_by_date
                ? daysUntil(renewal.cancel_by_date)
                : null
            return (
              <li key={renewal.id}>
                <Link href={`/renewals/${renewal.id}`} className="flex flex-col gap-2 p-4 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{renewal.vendor_name}</p>
                    <p className="text-xs text-slate-500">
                      {formatMoney(Number(renewal.amount), renewal.currency)} · {renewal.billing_cycle.replace('_', ' ')} · renews {formatDate(renewal.next_renewal_date)} ({daysLabel(days)})
                    </p>
                    {cancelDays !== null && cancelDays >= 0 && cancelDays <= 7 && (
                      <p className="mt-0.5 text-xs font-semibold text-rose-600">Cancel window closes {daysLabel(cancelDays)}</p>
                    )}
                  </div>
                  <span className={`self-start whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold capitalize sm:self-auto ${STATUS_CHIP[renewal.status]}`}>
                    {renewal.status}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between">
          {page > 1 ? (
            <Link href={buildHref(page - 1, status)} className="btn-secondary">← Previous</Link>
          ) : (
            <span aria-hidden="true" />
          )}
          <p className="text-sm text-slate-600">Page {page} of {totalPages}</p>
          {page < totalPages ? (
            <Link href={buildHref(page + 1, status)} className="btn-secondary">Next →</Link>
          ) : (
            <span aria-hidden="true" />
          )}
        </nav>
      )}
    </div>
  )
}
