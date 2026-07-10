# 4. Auth & Payments — RenewalRadar (auth_payments stage)

> Docs fragment owned by the auth_payments stage. The docs assembler concatenates
> numbered sections into the final SUPABASE-SETUP.md. Do not duplicate this content
> in other sections.

## 4.1 Environment variables (also emitted as `env.auth_payments.json`)

| Variable | Scope | Required | Purpose / Source |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client+server | yes | Supabase project URL (`zo_config.supabase_url`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client+server | yes | Supabase anon key (`zo_config.supabase_anon_key`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only** | yes | Webhook billing writes via `lib/stripe/db.ts` (`zo_config.supabase_service_role_key`) |
| `STRIPE_SECRET_KEY` | **server-only** | yes | Stripe API (`zo_config.stripe_test_secret_key` first; live only on explicit approval) |
| `STRIPE_WEBHOOK_SECRET` | **server-only** | yes | Generated when the webhook endpoint is created (see 4.4) |
| `STRIPE_PRICE_PRO_MONTHLY` | server-only | yes | Price id for Pro $9/mo (see 4.4) |
| `STRIPE_PRICE_PRO_YEARLY` | server-only | yes | Price id for Pro $89/yr |
| `STRIPE_PRICE_BUSINESS_MONTHLY` | server-only | yes | Price id for Business $29/mo |
| `STRIPE_PRICE_BUSINESS_YEARLY` | server-only | yes | Price id for Business $290/yr |
| `NEXT_PUBLIC_APP_URL` | client+server | yes | `https://renewalradar.zeroorigine.com` (checkout success/cancel + portal return URLs) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | client | no | NOT needed — we use hosted Stripe Checkout redirects, no client Stripe.js |

All vars must be set as **non-secret** on Netlify (secret vars are invisible at build time).

## 4.2 Supabase Auth configuration (Deploy Mind, via API)

- **Site URL:** `https://renewalradar.zeroorigine.com`
- **Redirect URLs:** `https://renewalradar.zeroorigine.com/**` and `http://localhost:3000/**`
- **Providers:** Email (enabled), **Google** and **GitHub** OAuth.
  - Google/GitHub OAuth app callback: `https://<project-ref>.supabase.co/auth/v1/callback`
  - The app-side OAuth landing is `/api/auth/callback` (code exchange, `next` param support).
- **Email templates:** DEFAULT templates work as-is — `/auth/confirm` handles both the
  default `?code=` format and custom `?token_hash=&type=` format. Just set the sender
  name to "RenewalRadar" (never "Supabase").
- **Email link handler map:**
  - Signup confirmation → `/auth/confirm?next=<destination>` → session → destination
  - Password recovery → `/auth/confirm?next=/reset-password` → `/reset-password`
  - OAuth → `/api/auth/callback?next=<destination>`

## 4.3 Flow contract (cross-stage, MUST be honored by landing + core)

1. Every paid CTA links to **`/signup?plan=pro`** or **`/signup?plan=business`** (optionally `&next=`).
2. The signup page persists the intent via `emailRedirectTo` (`next=/billing?intent=<plan>`)
   and user metadata `plan_intent`. Middleware also forwards signed-in users hitting
   `/signup?plan=X` straight to `/billing?intent=X`.
3. **core step MUST ship `/billing`** (e.g. `app/(dashboard)/billing/page.tsx`) that:
   - reads `?intent=pro|business` and immediately surfaces the upgrade → `POST /api/checkout`;
   - reads `?checkout=canceled` → friendly "no charge was made" note;
   - renders current plan + a "Manage billing" button → `POST /api/billing/portal`.
4. **core step's `/dashboard`** should celebrate `?checkout=success` (upgrade confirmation moment).
5. Plan data (names, prices, features, limits) comes ONLY from `@/lib/stripe/config` —
   never hardcode prices in UI. It matches the seeded `renewalradar_plans` rows
   (free / pro $9|$89 / business $29|$290).

## 4.4 Stripe setup (Deploy Mind, TEST mode first)

1. Verify account public business name = **ZeroOrigine**, statement descriptor `ZEROORIGINE`.
2. Create product **RenewalRadar Pro** with prices: $9.00/month, $89.00/year.
3. Create product **RenewalRadar Business** with prices: $29.00/month, $290.00/year.
4. Set the four `STRIPE_PRICE_*` env vars AND write the same ids into
   `renewalradar_plans.stripe_price_id_monthly/-_yearly` for `pro` and `business`.
5. Create webhook endpoint: `https://renewalradar.zeroorigine.com/api/webhooks/stripe`
   subscribed to EXACTLY: `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_succeeded`, `invoice.payment_failed` (exported as
   `STRIPE_WEBHOOK_EVENTS` in `lib/stripe/webhooks.ts`). Store the signing secret as
   `STRIPE_WEBHOOK_SECRET`.
6. Button-text honesty check: no trials are configured, so no UI may say "trial" —
   buttons read "Get Pro — $9/mo" style copy.

## 4.5 API contracts owned by this stage

| Route | Method | Auth | Contract |
|---|---|---|---|
| `/api/checkout` | POST | session + same-origin | `{ plan, interval? }` → `{ url, kind }`; 400 invalid plan/interval; 503 config |
| `/api/billing/portal` | POST | session + same-origin | `{}` → `{ url }`; 400 `no_billing_account` for Free users |
| `/api/auth/callback` | GET | none (pre-session) | OAuth/PKCE code exchange, `next` support |
| `/auth/confirm` | GET | none (pre-session) | Email link verification (token_hash or code), `next` support |
| `/api/auth/signout` | POST | session + same-origin | 303 → `/` for forms, `{ success: true }` for fetch |
| `/api/webhooks/stripe` | POST | Stripe signature | Billing state writer (service role) |

Never render `<a href="/api/...">` in pages — call these via fetch/forms. Unauthenticated
HTML GETs to protected APIs are redirected by middleware to `/login?next=<path>`.

## 4.6 Security posture & rate limiting

- Webhook signature verification on the raw body — non-negotiable, no bypass path.
- Card data never touches our servers (hosted Checkout + Portal; Stripe owns PCI).
- `renewalradar_subscriptions` / `renewalradar_payments`: client reads via RLS only;
  ALL writes via service role from webhook/checkout server code.
- CSRF: state-changing routes are POST-only JSON with an Origin/Host check; auth flows
  go through supabase-js (no cookie-authenticated form endpoints).
- Cookies: managed by `@supabase/ssr` (Secure, SameSite=Lax); middleware validates with
  `getUser()` (server-verified) on every request — never trusts raw cookies.
- Open-redirect protection: every `next` param is validated (relative, no `//`).
- Rate limits: Supabase Auth rate-limits login/signup/reset natively. Apply edge/CDN
  per-user caps (~10/min) on `/api/checkout` and `/api/billing/portal` if abuse appears.

## 4.7 Post-deploy verification (Gate 3 + payments)

1. `/signup?plan=pro` → create account → confirmation email arrives (RenewalRadar-branded).
2. Click link → lands on production `/billing?intent=pro` (not localhost) with upgrade surfaced.
3. Complete checkout with `4242 4242 4242 4242` (test mode) → `/dashboard?checkout=success`.
4. `renewalradar_subscriptions` row: `plan='pro'`, `status='active'`, customer + subscription ids set.
5. `renewalradar_payments` has a `succeeded` receipt row.
6. `POST /api/billing/portal` → portal opens → cancel → row downgrades to `plan='free'`.
7. Sign out → `/dashboard` redirects to `/login?next=/dashboard` → sign back in → no redirect loops.
8. Google + GitHub OAuth round-trips land on `/dashboard`.
