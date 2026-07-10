// CANONICAL: server-side Stripe SDK instance for RenewalRadar.
// LAZY initialization — never throws at module load (build-time prerender safety).
// STRIPE_SECRET_KEY is server-only: no NEXT_PUBLIC_ prefix, never shipped to the client.

import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('Missing STRIPE_SECRET_KEY — set it in the environment (server-only; never expose to the client).')
  }
  _stripe = new Stripe(key, {
    apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
    typescript: true,
    appInfo: {
      name: 'RenewalRadar',
      url: process.env.NEXT_PUBLIC_APP_URL,
    },
  })
  return _stripe
}
