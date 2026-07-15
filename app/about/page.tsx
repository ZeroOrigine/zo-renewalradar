// CANONICAL: /about, the ZeroOrigine birth certificate page for RenewalRadar.
// Facts are baked at generation time from the ecosystem database; they are historical.
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About · RenewalRadar',
  description:
    'RenewalRadar was born inside ZeroOrigine, an autonomous institution of AI Minds. Read its birth certificate: what it cost, who reviewed it, and the rules it was born under.',
  alternates: { canonical: '/about' },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'RenewalRadar',
  url: 'https://renewalradar.zeroorigine.com',
  email: 'hello@zeroorigine.com',
  parentOrganization: { '@type': 'Organization', name: 'ZeroOrigine', url: 'https://zeroorigine.com' },
}

const CERTIFICATE = [
  ['product', 'RenewalRadar'],
  ['born', '2026-07-10 · 22:28 UTC'],
  ['research score', '7.05 / 10'],
  ['ethics verdict', 'NEEDS FIXES · 7.8 / 10'],
  ['quality score', '128 / 140'],
  ['true cost', '$66.63 · 53 acts of machine reasoning'],
  ['human authors', 'none'],
  ['funded by', 'the founder'],
  ['biography', 'zeroorigine.com/story/renewalradar'],
]

export default function AboutPage() {
  return (
    <div className="bg-white text-slate-900 antialiased">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">About RenewalRadar</h1>

          <p className="mt-6 text-base leading-7 text-slate-600">
            <strong className="text-slate-900">RenewalRadar makes sure an auto-renewal never blindsides you again.</strong>{' '}
            It tracks subscriptions and vendor contracts, then alerts you before renewal and cancel-by dates,
            so unwanted charges never surprise you.
          </p>

          <section className="mt-10">
            <h2 className="text-xl font-bold tracking-tight">Who built this</h2>
            <p className="mt-3 text-base leading-7 text-slate-600">No human wrote a line of this product.</p>
            <p className="mt-3 text-base leading-7 text-slate-600">
              RenewalRadar was born inside <strong className="text-slate-900">ZeroOrigine</strong>, an autonomous
              institution: eight AI Minds with a constitution, a moral compass, and a budget. One Mind found the
              problem. Another judged it worth solving. An Ethics Mind reviewed it before a dollar was spent. A
              Builder wrote it, a QA Mind refused to ship it until it passed, and the machine deployed it. A
              human founder supervises the institution, not the code.
            </p>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Every product ZeroOrigine births publishes its full record: what it cost, what failed on the way,
              and who funded it. You can inspect all of it, including this product&apos;s complete build history,
              at <a href="https://zeroorigine.com" className="font-semibold text-emerald-600 hover:underline">zeroorigine.com</a>.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-xl font-bold tracking-tight">Birth certificate</h2>
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-6">
              <dl className="font-mono text-sm leading-7">
                {CERTIFICATE.map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-0.5 py-1 sm:flex-row sm:gap-4">
                    <dt className="shrink-0 text-slate-500 sm:w-40">{label}</dt>
                    <dd className="font-semibold text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              The cost figure is real and reconciles to the cent with ZeroOrigine&apos;s public treasury. Failed
              attempts are included, never hidden.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-xl font-bold tracking-tight">The rules it was born under</h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Before this product existed, an Ethics Mind reviewed the idea unprompted and returned a
              needs-fixes verdict. It warned that an email-forwarding feature could expose inbox contents far
              beyond trial confirmations, that inferred subscription behavior must never be monetized or sold,
              and that SMS reminders require real consent. Those requirements shaped what was built:
              RenewalRadar only knows what you explicitly tell it. The full constitution, all eleven articles,
              is public at <a href="https://zeroorigine.com/#law" className="font-semibold text-emerald-600 hover:underline">zeroorigine.com</a>.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-xl font-bold tracking-tight">Your data</h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Your data belongs to you. It is isolated per account, never sold, and never used for anything
              except making this product work for you. Details:{' '}
              <Link href="/privacy" className="font-semibold text-emerald-600 hover:underline">Privacy</Link>
              {' · '}
              <Link href="/terms" className="font-semibold text-emerald-600 hover:underline">Terms</Link>
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-xl font-bold tracking-tight">Questions</h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              A human answers:{' '}
              <a href="mailto:hello@zeroorigine.com" className="font-semibold text-emerald-600 hover:underline">hello@zeroorigine.com</a>
            </p>
            <p className="mt-2 text-base leading-7 text-slate-600">
              Want your name on the next product&apos;s birth certificate?{' '}
              <a href="https://zeroorigine.com/join" className="font-semibold text-emerald-600 hover:underline">Fund a birth</a>.
            </p>
          </section>
        </article>
      </main>
    </div>
  )
}
