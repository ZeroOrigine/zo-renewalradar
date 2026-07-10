// CANONICAL: /privacy — RenewalRadar privacy policy.
// PATCH v1 (self-validation): the landing and pricing footers linked to
// /privacy but no route existed — every legal-footer click was a 404.
// Plain-language policy that matches what the product actually does
// (and, just as importantly, what it never does).
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — RenewalRadar',
  description:
    'What RenewalRadar collects, what it never collects (no bank logins, no card numbers), and how your renewal data is protected.',
  alternates: { canonical: '/privacy' },
}

const SECTIONS: { title: string; paragraphs: string[] }[] = [
  {
    title: 'The short version',
    paragraphs: [
      'You tell us what renews and when; we watch the deadlines and email you before money moves. To do that we store your account details and the renewal entries you create — nothing more. We never see your bank account, we never store card numbers, and we never sell your data.',
    ],
  },
  {
    title: 'What we collect',
    paragraphs: [
      'Account information: your email address, and — if you sign in with Google or GitHub — the name and avatar those providers share with us.',
      'Renewal data you enter: vendor names, amounts, currencies, billing cycles, renewal dates, cancellation-notice periods, and any notes you add. You type it; we store it.',
      'Billing status: your plan, subscription status, and payment receipts, synced from Stripe. Card numbers never touch our servers — Stripe processes all payments.',
      'Operational basics: standard server logs (timestamps, status codes) used only to keep the service healthy.',
    ],
  },
  {
    title: 'What we never collect',
    paragraphs: [
      'No bank logins. No card numbers. No connection to your email inbox. No scraping your vendor accounts. RenewalRadar only knows what you explicitly tell it — that is the entire design.',
      'We do not run advertising trackers, and we do not sell or rent your data to anyone, ever.',
    ],
  },
  {
    title: 'How we use your data',
    paragraphs: [
      'To run your radar: computing cancel-by deadlines, building your dashboard totals, and sending the alert emails at the windows you configured.',
      'To bill you correctly if you upgrade, and to answer support requests when you write to us.',
    ],
  },
  {
    title: 'Who processes it',
    paragraphs: [
      'Supabase hosts our database and authentication. Stripe processes payments and stores payment methods. Resend delivers alert emails. Each processes only the data required for its job, and nothing is shared beyond that.',
    ],
  },
  {
    title: 'How it is protected',
    paragraphs: [
      'Data is encrypted in transit and at rest. Every account is isolated with database-level row security, so your renewals are only ever readable by you.',
    ],
  },
  {
    title: 'Your control',
    paragraphs: [
      'Edit or delete any renewal at any time. Pro and Business plans include full CSV export — your data is always yours to take with you.',
      'To delete your account and all associated data, email hello@renewalradar.app and we will confirm the deletion.',
    ],
  },
  {
    title: 'Questions',
    paragraphs: ['Email hello@renewalradar.app — a human reads it and a human replies.'],
  },
]

export default function PrivacyPage() {
  return (
    <div className="bg-white text-slate-900 antialiased">
      <header className="border-b border-white/10 bg-slate-950">
        <nav aria-label="Main navigation" className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="RenewalRadar home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                <circle cx="12" cy="12" r="8" />
                <circle cx="12" cy="12" r="3.5" />
                <path d="M12 12l5.5-5.5" />
              </svg>
            </span>
            <span className="text-lg font-bold tracking-tight text-white">RenewalRadar</span>
          </Link>
          <Link href="/" className="inline-flex min-h-[44px] items-center rounded-lg px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white">
            Back home
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <article>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Privacy Policy</h1>
          <p className="mt-3 text-sm text-slate-500">Last updated: January 2025</p>
          {SECTIONS.map((section) => (
            <section key={section.title} className="mt-10">
              <h2 className="text-xl font-bold tracking-tight">{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-3 text-base leading-7 text-slate-600">{paragraph}</p>
              ))}
            </section>
          ))}
        </article>
      </main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} RenewalRadar</p>
          <div className="flex gap-6">
            <Link href="/terms" className="transition hover:text-slate-900">Terms of Service</Link>
            <a href="mailto:hello@renewalradar.app" className="transition hover:text-slate-900">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
