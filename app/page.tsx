// CANONICAL: app/page.tsx — RenewalRadar marketing landing page.
// PATCH v3 (self-validation): \uXXXX escape sequences that sat directly inside
// JSX text nodes rendered LITERALLY (JSX does not decode escapes). All copy now
// uses real unicode characters. No structural or content changes otherwise.
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import PricingPlans from '@/components/marketing/pricing-plans'

export const metadata: Metadata = {
  title: 'RenewalRadar — Never get blindsided by an auto-renewal again',
  description:
    'RenewalRadar tracks every subscription, domain, and contract that auto-renews, computes your real cancel-by deadline, and emails you before the charge hits. Free for up to 5 renewals — no credit card required.',
  keywords: [
    'subscription tracker',
    'auto-renewal alerts',
    'renewal reminders',
    'cancel-by date',
    'SaaS spend',
    'subscription management',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'RenewalRadar — Never get blindsided by an auto-renewal again',
    description:
      'Track every auto-renewing subscription, see the real cancel-by deadline, and get alerted before money leaves your account. Free for up to 5 renewals.',
    type: 'website',
    siteName: 'RenewalRadar',
    url: '/',
  },
  twitter: {
    card: 'summary',
    title: 'RenewalRadar — catch every renewal before it catches you',
    description: 'Real cancel-by deadlines and email alerts for everything that auto-renews. Free for up to 5 renewals.',
  },
}

const RADAR_ROWS = [
  { vendor: 'Adobe Creative Cloud', initial: 'A', color: 'bg-rose-600', cost: '$659.88/yr', status: 'Cancel window closes in 3 days', chip: 'bg-red-500/10 text-red-400 ring-1 ring-inset ring-red-500/30', urgent: true },
  { vendor: 'Figma', initial: 'F', color: 'bg-purple-600', cost: '$144/yr', status: 'Renews in 12 days', chip: 'bg-amber-500/10 text-amber-400 ring-1 ring-inset ring-amber-500/30', urgent: false },
  { vendor: 'acme.com domain', initial: 'A', color: 'bg-violet-700', cost: '$21.99/yr', status: 'Renews in 27 days', chip: 'bg-slate-500/10 text-slate-300 ring-1 ring-inset ring-slate-500/30', urgent: false },
  { vendor: 'Notion', initial: 'N', color: 'bg-slate-700', cost: '$96/yr', status: 'Renews in 29 days', chip: 'bg-slate-500/10 text-slate-300 ring-1 ring-inset ring-slate-500/30', urgent: false },
]

const FEATURES: { title: string; desc: string; icon: ReactNode }[] = [
  {
    title: 'One radar, every renewal',
    desc: 'Subscriptions, domains, insurance, contracts — everything that auto-renews on one timeline, sorted by how soon it can hurt you.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
        <circle cx="12" cy="12" r="8.25" />
        <circle cx="12" cy="12" r="4.25" />
        <path d="M12 12l5.6-5.6" />
      </svg>
    ),
  },
  {
    title: 'Real cancel-by math',
    desc: 'Many vendors demand notice before renewal. Tell us the notice period once and we compute your actual last safe day to cancel — so “renews May 1” never fools you.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
        <rect x="3.75" y="5.25" width="16.5" height="14.25" rx="2.25" />
        <path d="M3.75 9.75h16.5M8.25 3v4.5M15.75 3v4.5" />
        <rect x="13.5" y="12.75" width="3.25" height="3.25" rx="0.75" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    title: 'Alerts before the charge',
    desc: 'Email alerts at the windows you choose — 30, 7, and 1 day out by default, up to six custom windows on Pro. Enough runway to cancel, downgrade, or renegotiate.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
        <path d="M12 5.25a5.25 5.25 0 0 0-5.25 5.25v2.4l-1.55 2.8a.75.75 0 0 0 .66 1.11h12.28a.75.75 0 0 0 .66-1.11l-1.55-2.8v-2.4A5.25 5.25 0 0 0 12 5.25Z" />
        <path d="M9.9 19.6a2.25 2.25 0 0 0 4.2 0" />
        <path d="M12 3v2.25" />
      </svg>
    ),
  },
  {
    title: 'Your monthly burn, one number',
    desc: 'Weekly, quarterly, and annual costs normalized to a single monthly total, so you always know exactly what your subscriptions cost per month.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
        <path d="M4 19V5M4 19h16" />
        <path d="M8 15l3-3 2.5 2.5L18 10" />
      </svg>
    ),
  },
  {
    title: '20-second capture',
    desc: 'Quick-picks for common vendors, smart defaults from your profile, and a live cancel-by readout as you type. Adding a renewal takes about 20 seconds.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
        <circle cx="12" cy="13" r="7.25" />
        <path d="M12 13V9.5M9.75 2.75h4.5" />
      </svg>
    ),
  },
  {
    title: 'Your data stays yours',
    desc: 'Export your entire radar to CSV any time on Pro — vendors, prices, cycles, deadlines, notes. No lock-in, ever.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
        <path d="M12 3v12m0 0l-4-4m4 4l4-4" />
        <path d="M4.5 17.25v1.5A2.25 2.25 0 0 0 6.75 21h10.5a2.25 2.25 0 0 0 2.25-2.25v-1.5" />
      </svg>
    ),
  },
]

const STEPS = [
  {
    title: 'Add a renewal in 20 seconds',
    desc: 'Pick a quick-add vendor or type your own — amount, billing cycle, next renewal date, and the vendor’s cancellation notice period if it has one.',
  },
  {
    title: 'We compute the real deadline',
    desc: 'RenewalRadar plots the renewal date AND the cancel-by date — the last day you can actually act — then schedules your alert windows automatically.',
  },
  {
    title: 'Act before the money moves',
    desc: 'Email alerts arrive with enough runway to cancel, downgrade, or renegotiate. Your dashboard always shows which cancel windows close this week.',
  },
]

const FAQS = [
  {
    q: 'Is the free plan actually useful, or a demo?',
    a: 'Actually useful. You get 5 tracked renewals with email alerts and real cancel-by deadline math — forever, no card. Put your five riskiest renewals on the radar; upgrade to Pro ($9/mo) only when you want unlimited tracking, custom alert schedules, and CSV export.',
  },
  {
    q: 'How do my renewals get into RenewalRadar?',
    a: 'You add them — and it’s fast on purpose. Quick-picks prefill common vendors (Netflix, Adobe, AWS, domains), and smart defaults mean most renewals take about 20 seconds to capture. No bank logins, no email scraping, no permissions to grant.',
  },
  {
    q: 'What is a “cancel-by date”?',
    a: 'Many contracts require notice before the renewal date — miss that window and you’re locked in for another term even if you cancel “in time.” Enter the notice period once and we compute your last safe day to cancel and alert you before it closes.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. Everything is encrypted in transit and at rest, and every account’s data is isolated with database-level row security. We never ask for bank logins or card numbers — you only tell us what renews and when.',
  },
  {
    q: 'Can I export my data?',
    a: 'Pro and Business plans include one-click CSV export of your entire radar — vendors, prices, cycles, cancel-by dates, and notes. It’s your data; we just watch it.',
  },
  {
    q: 'What happens if I cancel RenewalRadar?',
    a: 'You drop to the Free plan — nothing is deleted, and your five most important renewals keep their alerts. Cancelling takes two clicks in the billing portal. We’d be a pretty ironic product if cancelling was hard.',
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      name: 'RenewalRadar',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description:
        'RenewalRadar tracks auto-renewing subscriptions and contracts, computes real cancel-by deadlines, and sends alerts before every charge.',
      offers: {
        '@type': 'AggregateOffer',
        lowPrice: '0',
        highPrice: '29',
        priceCurrency: 'USD',
        offerCount: 3,
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQS.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ],
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
          <a href="#features" className="text-sm font-medium text-slate-300 transition hover:text-white">Features</a>
          <Link href="/pricing" className="text-sm font-medium text-slate-300 transition hover:text-white">Pricing</Link>
          <a href="#faq" className="text-sm font-medium text-slate-300 transition hover:text-white">FAQ</a>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login" className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white">Log in</Link>
          <Link href="/signup" className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:-translate-y-0.5 hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">
            Get started free
          </Link>
        </div>

        <details className="relative md:hidden">
          <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-lg text-slate-200 transition hover:bg-white/10 [&::-webkit-details-marker]:hidden" aria-label="Toggle navigation menu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-6 w-6" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </summary>
          <div className="absolute right-0 top-14 w-60 rounded-2xl border border-white/10 bg-slate-900 p-2 shadow-2xl">
            <a href="#features" className="block rounded-lg px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/10">Features</a>
            <Link href="/pricing" className="block rounded-lg px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/10">Pricing</Link>
            <a href="#faq" className="block rounded-lg px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/10">FAQ</a>
            <div className="my-2 border-t border-white/10" />
            <Link href="/login" className="block rounded-lg px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/10">Log in</Link>
            <Link href="/signup" className="mt-1 block rounded-lg bg-emerald-500 px-4 py-3 text-center text-sm font-semibold text-slate-950 hover:bg-emerald-400">Get started free</Link>
          </div>
        </details>
      </nav>
    </header>
  )
}

function RadarDemo() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div aria-hidden="true" className="absolute -inset-8 rounded-[2.5rem] bg-gradient-to-br from-emerald-500/25 via-teal-500/10 to-transparent blur-2xl" />

      <div className="relative rounded-2xl border border-white/10 bg-slate-900/90 p-5 shadow-2xl backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <p className="text-sm font-semibold text-white">Your radar — next 30 days</p>
          </div>
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-400">Preview</span>
        </div>

        <div className="mt-4 rounded-xl border border-white/5 bg-slate-800/60 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Your subscriptions cost</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-white">$76.83<span className="text-base font-semibold text-slate-400">/month</span></p>
          <p className="mt-1 text-xs font-medium text-emerald-400">1 cancel window closing this week</p>
        </div>

        <ul className="mt-3 space-y-2">
          {RADAR_ROWS.map((row) => (
            <li key={row.vendor} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3.5 py-3">
              <div className="flex items-center gap-3">
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white ${row.color}`} aria-hidden="true">{row.initial}</span>
                <div>
                  <p className="text-sm font-semibold text-white">{row.vendor}</p>
                  <p className="text-xs text-slate-400">{row.cost}</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${row.chip}`}>
                {row.urgent && (
                  <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                  </span>
                )}
                {row.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-slate-950">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-220px] h-[560px] w-[860px] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-16 sm:px-6 lg:grid lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-8 lg:pb-32 lg:pt-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-300">
            The average subscriber wastes hundreds a year on renewals they forgot
          </span>

          <h1 className="mt-6 font-display text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            Never get blindsided by an <span className="text-emerald-400">auto-renewal</span> again.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
            RenewalRadar watches every subscription, domain, and contract that auto-renews, works out your real cancel-by deadline — renewal date minus notice period — and emails you before money leaves your account.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/signup" className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-emerald-500 px-7 py-3.5 text-base font-semibold text-slate-950 shadow-xl shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">
              Start free — takes 60 seconds
            </Link>
            <a href="#how-it-works" className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-7 py-3.5 text-base font-semibold text-white transition hover:bg-white/10">
              See how it works
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </a>
          </div>

          <p className="mt-4 text-sm text-slate-400">Free forever for up to 5 renewals. No credit card required.</p>
        </div>

        <div className="mt-16 lg:mt-0">
          <RadarDemo />
        </div>
      </div>
    </section>
  )
}

function Features() {
  return (
    <section id="features" className="bg-slate-50 py-20 dark:bg-slate-900/40 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Features</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Your renewals have deadlines. Now you’ll actually see them.
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-300">
            RenewalRadar turns “wait, we still pay for that?” into a radar you check in ten seconds.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-950">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-600 transition group-hover:bg-emerald-600 group-hover:text-white dark:text-emerald-400">{f.icon}</div>
              <h3 className="mt-5 text-base font-bold text-slate-900 dark:text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white py-20 dark:bg-slate-950 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">How it works</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">From “I think it renews sometime” to radar, in three steps.</h2>
          <p className="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-300">No setup project. Your first renewal is on the radar before your coffee cools.</p>
        </div>

        <ol className="relative mt-16 grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8">
          <div aria-hidden="true" className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-emerald-300 to-transparent md:block dark:via-emerald-700" />
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-xl font-extrabold text-white shadow-lg shadow-emerald-600/25 ring-8 ring-white dark:ring-slate-950">{i + 1}</div>
              <h3 className="mt-6 text-lg font-bold text-slate-900 dark:text-white">{step.title}</h3>
              <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-slate-600 dark:text-slate-400">{step.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function PricingSection() {
  return (
    <section id="pricing" className="bg-slate-50 py-20 dark:bg-slate-900/40 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Pricing</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">Start free. Upgrade when 5 renewals isn’t enough.</h2>
          <p className="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-300">
            The Free plan isn’t a demo — 5 tracked renewals with real alerts, forever. Pro is $9/mo for unlimited tracking, custom alert schedules, Slack alerts, and CSV export.
          </p>
        </div>

        <div className="mt-12">
          <PricingPlans />
        </div>

        <p className="mt-10 text-center text-sm text-slate-500 dark:text-slate-400">
          Want the full breakdown?{' '}
          <Link href="/pricing" className="font-semibold text-emerald-600 transition hover:text-emerald-500 dark:text-emerald-400">Compare every feature →</Link>
        </p>
      </div>
    </section>
  )
}

function Faq() {
  return (
    <section id="faq" className="bg-white py-20 dark:bg-slate-950 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">FAQ</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">Questions, answered straight.</h2>
          <p className="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-300">Something else? Email hello@renewalradar.app — a human replies.</p>
        </div>

        <div className="mx-auto mt-12 max-w-3xl divide-y divide-slate-200 dark:divide-slate-800">
          {FAQS.map((f) => (
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
  )
}

function FinalCta() {
  return (
    <section className="bg-slate-50 py-20 dark:bg-slate-900/40 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-16 text-center shadow-2xl sm:px-16 sm:py-20">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-[-140px] h-[360px] w-[640px] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">Your next renewal is closer than you think.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-300">
              Put your five riskiest renewals on the radar tonight. If it never catches anything, it never costs you anything.
            </p>
            <div className="mt-9 flex justify-center">
              <Link href="/signup" className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-emerald-500 px-8 py-3.5 text-base font-semibold text-slate-950 shadow-xl shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">
                Start free — takes 60 seconds
              </Link>
            </div>
            <p className="mt-4 text-sm text-slate-400">No credit card required · Free plan forever · Cancel anytime (we’ll even remind you to)</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-400">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                  <circle cx="12" cy="12" r="8" />
                  <circle cx="12" cy="12" r="3.5" />
                  <path d="M12 12l5.5-5.5" />
                </svg>
              </span>
              <span className="text-base font-bold text-white">RenewalRadar</span>
            </div>
            <p className="mt-4 text-sm leading-6">Auto-renewals, un-surprised. Every deadline on one radar.</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Product</p>
            <ul className="mt-4 space-y-3 text-sm">
              <li><Link href="/#features" className="transition hover:text-white">Features</Link></li>
              <li><Link href="/pricing" className="transition hover:text-white">Pricing</Link></li>
              <li><Link href="/#faq" className="transition hover:text-white">FAQ</Link></li>
              <li><Link href="/signup" className="transition hover:text-white">Get started free</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Company & legal</p>
            <ul className="mt-4 space-y-3 text-sm">
              <li><a href="mailto:hello@renewalradar.app" className="transition hover:text-white">Contact</a></li>
              <li><Link href="/privacy" className="transition hover:text-white">Privacy Policy</Link></li>
              <li><Link href="/terms" className="transition hover:text-white">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-800 pt-8 sm:flex-row">
          <p className="text-sm">© {new Date().getFullYear()} RenewalRadar. All renewals reserved.</p>
          <p className="text-sm">Built with care — and a healthy fear of auto-renewals.</p>
        </div>
      </div>
    </footer>
  )
}

export default function HomePage() {
  return (
    <div className="bg-white text-slate-900 antialiased dark:bg-slate-950 dark:text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Nav />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <PricingSection />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
