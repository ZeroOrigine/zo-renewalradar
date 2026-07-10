// CANONICAL: /terms — RenewalRadar terms of service.
// PATCH v1 (self-validation): the landing and pricing footers linked to /terms
// but no route existed — a 404 from the marketing pages. Includes the
// business-critical disclaimer for this product: alerts are best-effort
// reminders, and users remain responsible for their own vendor contracts.
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service — RenewalRadar',
  description:
    'The plain-language terms for using RenewalRadar: plans and billing, what alerts do and do not guarantee, and your rights over your data.',
  alternates: { canonical: '/terms' },
}

const SECTIONS: { title: string; paragraphs: string[] }[] = [
  {
    title: 'The agreement',
    paragraphs: [
      'By creating an account or using RenewalRadar, you agree to these terms. If you are using RenewalRadar on behalf of a company, you agree on its behalf too.',
    ],
  },
  {
    title: 'The service',
    paragraphs: [
      'RenewalRadar tracks renewals you enter — subscriptions, domains, insurance, contracts — computes cancel-by deadlines from the dates and notice periods you provide, and sends alert emails at the windows you configure.',
    ],
  },
  {
    title: 'Your account',
    paragraphs: [
      'Keep your sign-in credentials safe and your email address current — alerts go to the email on your account, so a stale address means missed alerts. You are responsible for activity under your account.',
    ],
  },
  {
    title: 'Plans and billing',
    paragraphs: [
      'The Free plan is free forever and tracks up to 5 renewals. Paid plans (Pro and Business) are billed through Stripe at the prices shown at checkout, monthly or yearly.',
      'You can cancel or downgrade anytime in the billing portal. Changes take effect at the end of your current billing period, and you keep paid features until then. When a paid plan ends you drop to Free — nothing is deleted.',
      'If prices change, we will notify you by email before your next renewal. Yes, we appreciate the irony of being a renewal ourselves; we hold our own billing to the standard we preach.',
    ],
  },
  {
    title: 'Alerts are reminders, not guarantees',
    paragraphs: [
      'This part matters, so plainly: RenewalRadar sends best-effort reminders. Email can be delayed, filtered, or fail to deliver, and every deadline we compute is based on the dates, cycles, and notice periods YOU entered.',
      'RenewalRadar is not a party to your contracts with vendors and cannot cancel anything on your behalf. You remain solely responsible for cancelling, renegotiating, or paying for your subscriptions and contracts.',
      'To the maximum extent permitted by law, RenewalRadar is not liable for missed renewals, missed cancellation windows, vendor charges, or any losses arising from reliance on an alert that did not arrive or arrived late.',
    ],
  },
  {
    title: 'Acceptable use',
    paragraphs: [
      'Do not attempt to breach, probe, or overload the service, access data that is not yours, resell the service, or use it for anything unlawful. We may suspend accounts that do.',
    ],
  },
  {
    title: 'Your data',
    paragraphs: [
      'Your renewal data is yours. You grant us only the license needed to store and process it to operate the service. Pro and Business include CSV export so you can leave with everything, any time. See the Privacy Policy for details on handling.',
    ],
  },
  {
    title: 'Termination',
    paragraphs: [
      'You can stop using RenewalRadar and request account deletion at any time by emailing hello@renewalradar.app. We may suspend or terminate accounts that violate these terms; where practical we will warn you first.',
    ],
  },
  {
    title: 'Disclaimers and liability cap',
    paragraphs: [
      'The service is provided as-is and as-available, without warranties of any kind. To the maximum extent permitted by law, our total aggregate liability for any claim is capped at the fees you paid us in the 12 months before the claim arose.',
    ],
  },
  {
    title: 'Changes to these terms',
    paragraphs: [
      'We may update these terms as the product evolves. We will post updates here and email you about material changes before they apply. Continuing to use RenewalRadar after changes take effect means you accept them.',
    ],
  },
  {
    title: 'Contact',
    paragraphs: ['Questions about these terms? Email hello@renewalradar.app — a human replies.'],
  },
]

export default function TermsPage() {
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
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Terms of Service</h1>
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
            <Link href="/privacy" className="transition hover:text-slate-900">Privacy Policy</Link>
            <a href="mailto:hello@renewalradar.app" className="transition hover:text-slate-900">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
