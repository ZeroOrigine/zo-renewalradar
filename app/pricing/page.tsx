// CANONICAL: app/pricing/page.tsx — RenewalRadar pricing page.
// PATCH v3 (self-validation): two \uXXXX escapes inside JSX text nodes rendered
// literally; replaced with real characters. No other changes from v2.
import type { Metadata } from 'next'
import Link from 'next/link'
import PricingPlans from '@/components/marketing/pricing-plans'

export const metadata: Metadata = {
  title: 'Pricing — RenewalRadar',
  description:
    'Simple pricing: Free forever for up to 5 renewals, Pro at $9/mo ($89/yr), Business at $29/mo ($290/yr). No credit card required to start.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'RenewalRadar pricing — start free, upgrade when your stack outgrows you',
    description: 'Track 5 renewals free forever. Pro ($9/mo) adds unlimited tracking, custom alert schedules, Slack alerts, and CSV export.',
    type: 'website',
    siteName: 'RenewalRadar',
    url: '/pricing',
  },
  twitter: {
    card: 'summary',
    title: 'RenewalRadar pricing',
    description: 'Free forever for 5 renewals. Pro $9/mo. Business $29/mo. Two months free on annual.',
  },
}

type Cell = string | boolean

const COMPARISON: { label: string; free: Cell; pro: Cell; business: Cell }[] = [
  { label: 'Renewals tracked', free: '5', pro: 'Unlimited', business: 'Unlimited' },
  { label: 'Email alerts before every charge', free: true, pro: true, business: true },
  { label: 'Alert windows per renewal', free: '2', pro: 'Up to 6, custom', business: 'Up to 6, custom' },
  { label: 'Real cancel-by deadline math', free: true, pro: true, business: true },
  { label: 'Monthly burn & annual projection dashboard', free: true, pro: true, business: true },
  { label: 'Slack alerts', free: false, pro: true, business: true },
  { label: 'One-click CSV export', free: false, pro: true, business: true },
  { label: 'Team seats', free: '1', pro: '1', business: '5' },
  { label: 'Priority support', free: false, pro: false, business: true },
]

const PRICING_FAQS = [
  {
    q: 'Can I switch plans later?',
    a: 'Anytime. Upgrades apply instantly through Stripe; downgrades and cancellations happen in the billing portal and take effect at the end of your billing period. Your radar and its history stay intact either way.',
  },
  {
    q: 'What counts as a “renewal”?',
    a: 'One thing you’re tracking that renews — a SaaS subscription, a domain, an insurance policy, a contract. Canceled and expired items never count against your limit.',
  },
  {
    q: 'What happens when I hit 5 renewals on Free?',
    a: 'Nothing breaks. Your existing 5 keep their alerts; you just can’t add a 6th until you upgrade or remove one. We’ll never silently stop watching a deadline.',
  },
  {
    q: 'Do annual plans really save money?',
    a: 'Yes — about two months free. Pro drops from $108 to $89 a year; Business from $348 to $290.',
  },
  {
    q: 'Is there a trial for Pro?',
    a: 'No trial needed — the Free plan is the trial that never expires. When you upgrade, Pro starts instantly, and you can cancel anytime from the billing portal.',
  },
]

function IncludedIcon() {
  return (
    <span className="inline-flex items-center justify-center">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-emerald-500" aria-hidden="true">
        <path d="M4.5 12.75l6 6 9-13.5" />
      </svg>
      <span className="sr-only">Included</span>
    </span>
  )
}

function CellValue({ value }: { value: Cell }) {
  if (value === true) return <IncludedIcon />
  if (value === false)
    return (
      <span className="text-slate-300 dark:text-slate-600">
        —<span className="sr-only">Not included</span>
      </span>
    )
  return <span className="text-slate-700 dark:text-slate-300">{value}</span>
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/85 backdrop-blur">
      <nav aria-label="Main navigation" className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="RenewalRadar home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 shadow-lg shadow-emerald-500/30">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
              <circle cx="12" cy="12" r="8" />
              <circle cx="12" cy="12" r="3.5" />
              <path d="M12 12l5.5-5.5" />
            </svg>
          </span>
          <span className="text-lg font-bold tracking-tight text-white">RenewalRadar</span>
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          <Link href="/#features" className="text-sm font-medium text-slate-300 transition hover:text-white">Features</Link>
          <Link href="/pricing" aria-current="page" className="text-sm font-semibold text-white">Pricing</Link>
          <Link href="/#faq" className="text-sm font-medium text-slate-300 transition hover:text-white">FAQ</Link>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login" className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white">Log in</Link>
          <Link href="/signup" className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:-translate-y-0.5 hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">Get started free</Link>
        </div>
        <details className="relative md:hidden">
          <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-lg text-slate-200 transition hover:bg-white/10 [&::-webkit-details-marker]:hidden" aria-label="Toggle navigation menu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-6 w-6" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </summary>
          <div className="absolute right-0 top-14 w-60 rounded-2xl border border-white/10 bg-slate-900 p-2 shadow-2xl">
            <Link href="/#features" className="block rounded-lg px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/10">Features</Link>
            <Link href="/pricing" className="block rounded-lg px-4 py-3 text-sm font-semibold text-white">Pricing</Link>
            <Link href="/#faq" className="block rounded-lg px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/10">FAQ</Link>
            <div className="my-2 border-t border-white/10" />
            <Link href="/login" className="block rounded-lg px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/10">Log in</Link>
            <Link href="/signup" className="mt-1 block rounded-lg bg-emerald-500 px-4 py-3 text-center text-sm font-semibold text-slate-950 hover:bg-emerald-400">Get started free</Link>
          </div>
        </details>
      </nav>
    </header>
  )
}

export default function PricingPage() {
  return (
    <div className="bg-white text-slate-900 antialiased dark:bg-slate-950 dark:text-white">
      <Nav />
      <main>
        <section className="relative overflow-hidden bg-slate-950 pb-16 pt-16 sm:pt-20">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-[-200px] h-[420px] w-[760px] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-3xl" />
          </div>
          <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">Pricing</p>
            <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl">Start free. Upgrade when your stack outgrows you.</h1>
            <p className="mt-5 text-lg leading-8 text-slate-300">
              Five tracked renewals, free forever. Pro is $9 a month — it pays for itself the first time it catches a renewal you would have missed.
            </p>
            <p className="mt-4 text-sm text-slate-400">No credit card required to start. Cancel or downgrade anytime.</p>
          </div>
        </section>

        <section className="bg-slate-50 py-16 dark:bg-slate-900/40 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <PricingPlans />

            <div className="mx-auto mt-16 max-w-4xl text-center">
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Every feature, side by side.</h2>
              <p className="mt-3 text-base text-slate-600 dark:text-slate-300">No fine print. If a row is unclear, email us and we’ll answer honestly.</p>
            </div>

            <div className="mt-10 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th scope="col" className="w-2/5 px-6 py-5 font-semibold text-slate-900 dark:text-white">Compare plans</th>
                    <th scope="col" className="px-6 py-5 text-center">
                      <span className="block text-sm font-bold text-slate-900 dark:text-white">Free</span>
                      <span className="mt-1 block text-xs font-medium text-slate-500 dark:text-slate-400">$0 forever</span>
                    </th>
                    <th scope="col" className="bg-emerald-50/70 px-6 py-5 text-center dark:bg-emerald-500/5">
                      <span className="block text-sm font-bold text-emerald-700 dark:text-emerald-400">Pro</span>
                      <span className="mt-1 block text-xs font-medium text-slate-500 dark:text-slate-400">$9/mo · $89/yr</span>
                    </th>
                    <th scope="col" className="px-6 py-5 text-center">
                      <span className="block text-sm font-bold text-slate-900 dark:text-white">Business</span>
                      <span className="mt-1 block text-xs font-medium text-slate-500 dark:text-slate-400">$29/mo · $290/yr</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.label} className="border-b border-slate-100 last:border-0 odd:bg-slate-50/60 dark:border-slate-800/60 dark:odd:bg-slate-900/40">
                      <th scope="row" className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">{row.label}</th>
                      <td className="px-6 py-4 text-center"><CellValue value={row.free} /></td>
                      <td className="bg-emerald-50/40 px-6 py-4 text-center dark:bg-emerald-500/5"><CellValue value={row.pro} /></td>
                      <td className="px-6 py-4 text-center"><CellValue value={row.business} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="billing-faq" className="bg-white py-16 dark:bg-slate-950 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Billing FAQ</p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">The money questions, answered.</h2>
            </div>
            <div className="mx-auto mt-10 max-w-3xl divide-y divide-slate-200 dark:divide-slate-800">
              {PRICING_FAQS.map((f) => (
                <details key={f.q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left [&::-webkit-details-marker]:hidden">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">{f.q}</h3>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5 shrink-0 text-emerald-600 transition-transform duration-200 group-open:rotate-45 dark:text-emerald-400" aria-hidden="true">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </summary>
                  <p className="mt-3 pr-9 text-sm leading-6 text-slate-600 dark:text-slate-400">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white pb-20 dark:bg-slate-950 sm:pb-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-14 text-center shadow-2xl dark:border dark:border-slate-800 sm:px-16 sm:py-16">
              <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/2 top-[-120px] h-[300px] w-[560px] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" />
              </div>
              <div className="relative">
                <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">Still weighing it? Start where it’s free.</h2>
                <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-300">
                  Track your 5 riskiest renewals on the Free plan tonight. If the radar never catches anything, it never costs you anything.
                </p>
                <div className="mt-8 flex justify-center">
                  <Link href="/signup" className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-emerald-500 px-8 py-3.5 text-base font-semibold text-slate-950 shadow-xl shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">
                    Start free — takes 60 seconds
                  </Link>
                </div>
                <p className="mt-4 text-sm text-slate-400">No credit card required · Upgrade or cancel anytime</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-slate-950 text-slate-400">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm">© {new Date().getFullYear()} RenewalRadar. All renewals reserved.</p>
            <ul className="flex items-center gap-6 text-sm">
              <li><Link href="/privacy" className="transition hover:text-white">Privacy</Link></li>
              <li><Link href="/terms" className="transition hover:text-white">Terms</Link></li>
              <li><a href="mailto:hello@renewalradar.app" className="transition hover:text-white">Contact</a></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  )
}
