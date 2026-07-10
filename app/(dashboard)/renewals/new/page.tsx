'use client'

// CANONICAL: /renewals/new — the 20-second capture form. Quick-picks prefill
// common vendors; a live cancel-by readout updates as you type. Wired to
// POST /api/renewals; surfaces field errors and the plan-limit upsell.

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { BillingCycle, RenewalCategory } from '@/lib/db/types'
import { CATEGORY_OPTIONS, COMMON_CURRENCIES, CYCLE_OPTIONS, daysLabel, daysUntil, formatDate } from '@/lib/core/format'
import { ToastViewport, useToast } from '@/lib/core/toast'

const ALERT_OPTIONS = [90, 60, 30, 14, 7, 3, 1]

const QUICK_PICKS: { name: string; category: RenewalCategory; cycle: BillingCycle; amount: string }[] = [
  { name: 'Netflix', category: 'software', cycle: 'monthly', amount: '15.49' },
  { name: 'Adobe Creative Cloud', category: 'software', cycle: 'annual', amount: '659.88' },
  { name: 'Domain renewal', category: 'domain', cycle: 'annual', amount: '19.99' },
  { name: 'AWS', category: 'infrastructure', cycle: 'monthly', amount: '' },
  { name: 'Notion', category: 'software', cycle: 'annual', amount: '96' },
  { name: 'Business insurance', category: 'insurance', cycle: 'annual', amount: '' },
]

function computeCancelBy(date: string, noticeDays: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return null
  parsed.setUTCDate(parsed.getUTCDate() - noticeDays)
  return parsed.toISOString().slice(0, 10)
}

export default function NewRenewalPage() {
  const router = useRouter()
  const { toast, showToast } = useToast()

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
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [limitError, setLimitError] = useState<string | null>(null)

  function applyQuickPick(pick: (typeof QUICK_PICKS)[number]) {
    setVendor(pick.name)
    setCategory(pick.category)
    setCycle(pick.cycle)
    if (pick.amount) setAmount(pick.amount)
  }

  const noticeDays = Math.max(0, Number.parseInt(notice, 10) || 0)
  const cancelBy = autoRenews && noticeDays > 0 ? computeCancelBy(date, noticeDays) : null

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setFieldErrors({})
    setLimitError(null)
    try {
      const amountNumber = Number.parseFloat(amount)
      const response = await fetch('/api/renewals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_name: vendor.trim(),
          amount: Number.isFinite(amountNumber) && amountNumber >= 0 ? amountNumber : 0,
          currency,
          billing_cycle: cycle,
          category,
          next_renewal_date: date,
          auto_renews: autoRenews,
          cancel_notice_days: noticeDays,
          alert_days_before: alerts.length > 0 ? alerts : [30, 7, 1],
          notes: notes.trim() || null,
        }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.data?.renewal) {
        if (json?.code === 'PLAN_LIMIT_REACHED') {
          setLimitError(json.error as string)
        } else {
          setFieldErrors(json?.fields ?? {})
          showToast(typeof json?.error === 'string' ? json.error : "We couldn't save that renewal just now. Try again.", 'error')
        }
        return
      }
      router.push(`/renewals/${json.data.renewal.id as string}`)
      router.refresh()
    } catch {
      showToast("We couldn't reach the server. Check your connection and try again.", 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <ToastViewport toast={toast} />

      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/renewals" className="font-medium text-indigo-600 hover:text-indigo-500">← All renewals</Link>
      </nav>

      <header className="animate-rise">
        <h1 className="text-2xl">Add a renewal</h1>
        <p className="mt-1 text-sm text-slate-600">About 20 seconds — we'll handle the deadline math.</p>
      </header>

      {limitError && (
        <div role="alert" className="animate-pop rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-medium text-amber-900">{limitError}</p>
          <Link href="/billing?intent=pro" className="btn-primary mt-3">Upgrade to Pro</Link>
        </div>
      )}

      <div className="animate-rise-1">
        <p className="field-label">Quick picks</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {QUICK_PICKS.map((pick) => (
            <button
              key={pick.name}
              type="button"
              onClick={() => applyQuickPick(pick)}
              className="inline-flex min-h-[44px] items-center rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-600 transition-colors hover:border-indigo-400 hover:text-indigo-700"
            >
              {pick.name}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card animate-rise-2 space-y-5 p-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="vendor" className="field-label">Vendor</label>
            <input id="vendor" required value={vendor} onChange={(e) => setVendor(e.target.value)} className="field-input" placeholder="e.g. Figma" />
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
            <label htmlFor="amount" className="field-label">Amount (per cycle)</label>
            <input id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="field-input" placeholder="49.99" />
            {fieldErrors.amount && <p className="field-error">{fieldErrors.amount}</p>}
          </div>
          <div>
            <label htmlFor="currency" className="field-label">Currency</label>
            <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="field-input">
              {COMMON_CURRENCIES.map((code) => (
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
            <p className="field-hint">How many days before renewal the vendor requires cancellation. Leave 0 if none.</p>
          </div>
          <div className="flex items-center gap-3 pt-6">
            <input id="autoRenews" type="checkbox" checked={autoRenews} onChange={(e) => setAutoRenews(e.target.checked)} className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <label htmlFor="autoRenews" className="text-sm font-medium text-slate-700">Auto-renews (charges unless canceled)</label>
          </div>
        </div>

        {cancelBy && (
          <p role="status" className="rounded-xl bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-800">
            Last safe day to cancel: {formatDate(cancelBy)} ({daysLabel(daysUntil(cancelBy))})
          </p>
        )}

        <fieldset>
          <legend className="field-label">Alert windows (days before renewal)</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {ALERT_OPTIONS.map((option) => {
              const active = alerts.includes(option)
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setAlerts((current) => (current.includes(option) ? current.filter((d) => d !== option) : current.length >= 6 ? current : [...current, option]))}
                  className={`inline-flex min-h-[44px] items-center rounded-full border px-4 text-sm font-medium transition-colors ${active ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'}`}
                >
                  {option}d
                </button>
              )
            })}
          </div>
          <p className="field-hint">Free applies your first 2 windows; Pro supports up to 6.</p>
          {fieldErrors.alert_days_before && <p className="field-error">{fieldErrors.alert_days_before}</p>}
        </fieldset>

        <div>
          <label htmlFor="notes" className="field-label">Notes (optional)</label>
          <textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="field-input" placeholder="Account owner, cancellation steps, contract link…" />
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-5">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Adding to radar…' : 'Add to radar'}
          </button>
        </div>
      </form>
    </div>
  )
}
