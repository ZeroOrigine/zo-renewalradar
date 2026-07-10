// CANONICAL: Stripe Billing Portal session creation.
// The portal is the user's escape hatch: change plan, update card, download
// invoices, cancel anytime. Empowerment over dependency — Stripe hosts it all.

import { getStripe } from './client'

export async function createBillingPortalSession(customerId: string, returnUrl: string): Promise<string> {
  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })
  return session.url
}
