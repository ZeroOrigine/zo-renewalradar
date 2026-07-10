// CANONICAL: RenewalRadar Tailwind config.
// - Scans app/, components/, AND lib/ (shared UI lives in lib/core — this makes
//   the tailwind-safelist shim unnecessary).
// - Defines the `brand` palette (indigo) used by the auth pages so brand-*
//   classes actually resolve.
import type { Config } from 'tailwindcss'
import colors from 'tailwindcss/colors'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: colors.indigo,
      },
      fontFamily: {
        sans: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
