// CANONICAL: RenewalRadar root layout — fonts (--font-body/--font-display,
// consumed by tailwind.config.ts), global CSS, explicit viewport, metadataBase.
import type { Metadata, Viewport } from 'next'
import { Inter, Sora } from 'next/font/google'
import './globals.css'

const body = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' })
const display = Sora({ subsets: ['latin'], variable: '--font-display', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: {
    default: 'RenewalRadar — Never get blindsided by an auto-renewal again',
    template: '%s · RenewalRadar',
  },
  description:
    'Track every subscription, domain, and contract that auto-renews. Real cancel-by deadlines, email alerts before every charge.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  )
}
