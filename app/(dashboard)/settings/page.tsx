'use client'

// CANONICAL: /settings — profile preferences: name, default currency,
// timezone, and default alert windows applied to new renewals.

import { useEffect, useState } from 'react'
import type { Profile } from '@/lib/db/types'
import { COMMON_CURRENCIES } from '@/lib/core/format'
import { ToastViewport, useToast } from '@/lib/core/toast'

const ALERT_OPTIONS = [90, 60, 30, 14, 7, 3, 1]

export default function SettingsPage() {
  const { toast, showToast } = useToast()
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [timezone, setTimezone] = useState('UTC')
  const [alertDays, setAlertDays] = useState<number[]>([30, 7, 1])

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/profile', { signal: controller.signal })
      .then((response) => response.json().then((json) => ({ ok: response.ok, json })))
      .then(({ ok, json }) => {
        if (!ok || !json?.data?.profile) throw new Error('load-failed')
        const profile = json.data.profile as Profile
        setEmail(profile.email)
        setFullName(profile.full_name ?? '')
        setCurrency(profile.default_currency)
        setTimezone(profile.timezone)
        setAlertDays(profile.default_alert_days ?? [30, 7, 1])
        setLoaded(true)
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true)
      })
    return () => controller.abort()
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim() || null,
          default_currency: currency,
          timezone: timezone.trim() || 'UTC',
          default_alert_days: alertDays.length > 0 ? alertDays : [30, 7, 1],
        }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.data?.profile) {
        showToast(json?.error ?? "We couldn't save your settings just now. Try again.", 'error')
        return
      }
      showToast('Settings saved.')
    } catch {
      showToast("We couldn't reach the server. Check your connection and try again.", 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loadError) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <p className="font-medium text-slate-900">We couldn't load your settings. Refresh to try again.</p>
      </div>
    )
  }

  if (!loaded) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading settings">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-96 max-w-2xl" />
      </div>
    )
  }

  const timezoneOptions =
    typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['UTC']

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <ToastViewport toast={toast} />
      <header className="animate-rise">
        <h1 className="text-2xl">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">Defaults for new renewals and how we talk to you.</p>
      </header>

      <form onSubmit={handleSubmit} className="card animate-rise-1 space-y-5 p-6">
        <div>
          <label htmlFor="email" className="field-label">Email</label>
          <input id="email" value={email ?? ''} disabled className="field-input" />
          <p className="field-hint">Alerts go here. Email changes happen through your sign-in provider.</p>
        </div>
        <div>
          <label htmlFor="fullName" className="field-label">Name</label>
          <input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} className="field-input" placeholder="Ada Lovelace" />
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="currency" className="field-label">Default currency</label>
            <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="field-input">
              {((COMMON_CURRENCIES as readonly string[]).includes(currency) ? [...COMMON_CURRENCIES] : [currency, ...COMMON_CURRENCIES]).map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="timezone" className="field-label">Timezone</label>
            <select id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} className="field-input">
              {(timezoneOptions.includes(timezone) ? timezoneOptions : [timezone, ...timezoneOptions]).map((zone) => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
          </div>
        </div>
        <fieldset>
          <legend className="field-label">Default alert windows for new renewals</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {Array.from(new Set([...ALERT_OPTIONS, ...alertDays])).sort((a, b) => b - a).map((option) => {
              const active = alertDays.includes(option)
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setAlertDays((current) => (current.includes(option) ? current.filter((d) => d !== option) : current.length >= 6 ? current : [...current, option]))}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${active ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'}`}
                >
                  {option}d
                </button>
              )
            })}
          </div>
          <p className="field-hint">Free plans apply the first 2 windows; Pro supports up to 6.</p>
        </fieldset>
        <div className="flex justify-end border-t border-slate-100 pt-5">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
