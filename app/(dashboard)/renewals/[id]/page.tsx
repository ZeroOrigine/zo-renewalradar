'use client'

// CANONICAL: /renewals/[id] — detail + edit + pause/resume + delete for one
// renewal. Every list/dashboard row links here; this page must exist.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import type { BillingCycle, Renewal, RenewalCategory } from '@/lib/db/types'
import { CATEGORY_OPTIONS, COMMON_CURRENCIES, CYCLE_OPTIONS, daysLabel, daysUntil, formatDate, formatMoney } from '@/lib/core/format'
import { ToastViewport, useToast } from '@/lib/core/toast'

const ALERT_OPTIONS = [90, 60, 30, 14, 7, 3, 1]

export default function RenewalDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { toast, showToast } = useToast()

  const [renewal, setRenewal] = useState<Renewal | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Editable fields
  const [vendor, setVendor] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [cycle, setCycle] = useState<BillingCycle>('annual')
  const [category, setCategory] = useState<RenewalCategory>('software')
  const [date, setDate] = useState('')
  const [autoRenews, setAutoRenews] = useState(true)
  const [notice, setNotice] = useState('0')
  const [alerts, setAlerts] = useState<number[]>([30, 7, 1])
  const [notes, setNotes] = useState('')

  function hydrate(next: Renewal) {
    setRenewal(next)
    setVendor(next.vendor_name)
    setAmount(String(next.amount))
    setCurrency(next.currency)
    setCycle(next.billing_cycle)
    setCategory(next.category)
    setDate(next.next_renewal_date)
    setAutoRenews(next.auto_renews)
    setNotice(String(next.cancel_notice_days))
    setAlerts(next.alert_days_before ?? [30, 7, 1])
    setNotes(next.notes ?? '')
  }

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/renewals/${params.id}`, { signal: controller.signal })
      .then((response) => response.json().then((json) => ({ ok: response.ok, json })))
      .then(({ ok, json }) => {
        if (!ok || !json?.data?.renewal) throw new Error(json?.error ?? 'load-failed')
        hydrate(json.data.renewal as Renewal)
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError("We couldn't find that renewal. It may have been deleted.")
      })
    return () => controller.abort()
  }, [params.id])

  async function patchRenewal(patch: Record<string, unknown>, successMessage: string) {
    setSaving(true)
    setFieldErrors({})
    try {
      const response = await fetch(`/api/renewals/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.data?.renewal) {
        setFieldErrors(json?.fields ?? {})
        showToast(json?.error ?? "We couldn't save that just now. Try again in a moment.", 'error')
        return
      }
      hydrate(json.data.renewal as Renewal)
      showToast(successMessage)
    } catch {
      showToast("We couldn't reach the server. Check your connection and try again.", 'error')
    } finally {
      setSaving(false)
    }
  }

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amountNumber = Number.parseFloat(amount)
    patchRenewal(
      {
        vendor_name: vendor.trim(),
        amount: Number.isFinite(amountNumber) && amountNumber >= 0 ? amountNumber : 0,
        currency,
        billing_cycle: cycle,
        category,
        next_renewal_date: date,
        auto_renews: autoRenews,
        cancel_notice_days: Math.max(0, Number.parseInt(notice, 10) || 0),
        alert_days_before: alerts.length > 0 ? alerts : [30, 7, 1],
        notes: notes.trim() || null,
      },
      'Saved — your radar is up to date.'
    )
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const response = await fetch(`/api/renewals/${params.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const json = await response.json().catch(() => null)
        showToast(json?.error ?? "We couldn't delete that just now. Try again.", 'error')
        setDeleting(false)
        return
      }
      router.push('/renewals')
      router.refresh()
    } catch {
      showToast("We couldn't reach the server. Try again in a moment.", 'error')
      setDeleting(false)
    }
  }

  if (loadError) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <p className="font-medium text-slate-900">{loadError}</p>
        <Link href="/renewals" className="btn-secondary mt-4 inline-flex">Back to renewals</Link>
      </div>
    )
  }

  if (!renewal) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading renewal">
        <div className="skeleton h-8 w-64 max-w-full" />
        <div className="skeleton h-40" />
        <div className="skeleton h-96" />
      </div>
    )
  }

  const days = daysUntil(renewal.next_renewal_date)
  const cancelDays = renewal.cancel_by_date ? daysUntil(renewal.cancel_by_date) : null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <ToastViewport toast={toast} />

      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/renewals" className="font-medium text-indigo-600 hover:text-indigo-500">← All renewals</Link>
      </nav>

      <header className="animate-rise flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl">{renewal.vendor_name}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {formatMoney(Number(renewal.amount), renewal.currency)} · renews {formatDate(renewal.next_renewal_date)} ({daysLabel(days)})
          </p>
          {renewal.status === 'active' && renewal.auto_renews && cancelDays !== null && cancelDays >= 0 && (
            <p className={`mt-1 text-sm font-semibold ${cancelDays <= 7 ? 'text-rose-600' : 'text-slate-600'}`}>
              {cancelDays === 0 ? 'Today is the last safe day to cancel.' : `Last safe day to cancel: ${formatDate(renewal.cancel_by_date!)} (${daysLabel(cancelDays)})`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {renewal.status === 'active' ? (
            <button type="button" disabled={saving} onClick={() => patchRenewal({ status: 'paused' }, 'Paused — alerts are off for this one.')} className="btn-secondary">
              Pause alerts
            </button>
          ) : renewal.status === 'paused' ? (
            <button type="button" disabled={saving} onClick={() => patchRenewal({ status: 'active' }, 'Back on the radar — alerts resumed.')} className="btn-secondary">
              Resume alerts
            </button>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">{renewal.status}</span>
          )}
          {renewal.status === 'active' && (
            <button type="button" disabled={saving} onClick={() => patchRenewal({ status: 'canceled' }, 'Marked canceled — nice save.')} className="btn-secondary">
              I canceled it
            </button>
          )}
        </div>
      </header>

      <form onSubmit={handleSave} className="card animate-rise-1 space-y-5 p-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="vendor" className="field-label">Vendor</label>
            <input id="vendor" required value={vendor} onChange={(e) => setVendor(e.target.value)} className="field-input" />
            {fieldErrors.vendor_name && <p className="field-error">{fieldErrors.vendor_name}</p>}
          </div>
          <div>
            <label htmlFor="category" className="field-label">Category</label>
            <select id="category" value={category} onChange={(e) => setCategory(e.target.value as RenewalCategory)} className="field-input">
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="amount" className="field-label">Amount</label>
            <input id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="field-input" />
            {fieldErrors.amount && <p className="field-error">{fieldErrors.amount}</p>}
          </div>
          <div>
            <label htmlFor="currency" className="field-label">Currency</label>
            <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="field-input">
              {((COMMON_CURRENCIES as readonly string[]).includes(currency) ? [...COMMON_CURRENCIES] : [currency, ...COMMON_CURRENCIES]).map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="cycle" className="field-label">Billing cycle</label>
            <select id="cycle" value={cycle} onChange={(e) => setCycle(e.target.value as BillingCycle)} className="field-input">
              {CYCLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="date" className="field-label">Next renewal date</label>
            <input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="field-input" />
            {fieldErrors.next_renewal_date && <p className="field-error">{fieldErrors.next_renewal_date}</p>}
          </div>
          <div>
            <label htmlFor="notice" className="field-label">Cancellation notice (days)</label>
            <input id="notice" inputMode="numeric" value={notice} onChange={(e) => setNotice(e.target.value)} className="field-input" />
            <p className="field-hint">How many days before renewal the vendor requires cancellation.</p>
          </div>
          <div className="flex items-center gap-3 pt-6">
            <input id="autoRenews" type="checkbox" checked={autoRenews} onChange={(e) => setAutoRenews(e.target.checked)} className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <label htmlFor="autoRenews" className="text-sm font-medium text-slate-700">Auto-renews (charges unless canceled)</label>
          </div>
        </div>

        <fieldset>
          <legend className="field-label">Alert windows (days before renewal)</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {Array.from(new Set([...ALERT_OPTIONS, ...alerts])).sort((a, b) => b - a).map((option) => {
              const active = alerts.includes(option)
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setAlerts((current) => (current.includes(option) ? current.filter((d) => d !== option) : current.length >= 6 ? current : [...current, option]))}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${active ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'}`}
                >
                  {option}d
                </button>
              )
            })}
          </div>
          {fieldErrors.alert_days_before && <p className="field-error">{fieldErrors.alert_days_before}</p>}
        </fieldset>

        <div>
          <label htmlFor="notes" className="field-label">Notes</label>
          <textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="field-input" placeholder="Account owner, cancellation steps, contract link…" />
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-5">
          {confirmingDelete ? (
            <div className="flex items-center gap-3">
              <button type="button" onClick={handleDelete} disabled={deleting} className="btn-danger">
                {deleting ? 'Deleting…' : 'Yes, delete it'}
              </button>
              <button type="button" onClick={() => setConfirmingDelete(false)} className="text-sm font-medium text-slate-600 hover:text-slate-900">Keep it</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmingDelete(true)} className="btn-danger">Delete renewal</button>
          )}
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
