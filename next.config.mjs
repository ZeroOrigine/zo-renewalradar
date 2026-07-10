// CANONICAL: next.config.mjs — security headers + explicit CORS stance.
// PATCH v2 (self-validation): the previous CORS comment claimed EVERY
// state-changing route performs an explicit Origin/Host check. That was not
// accurate. The truthful, layered model is:
//   1. Same-origin API: we send NO Access-Control-Allow-Origin header, so
//      browsers block cross-origin reads, and cross-origin JSON writes fail
//      the CORS preflight.
//   2. Supabase auth cookies are SameSite=Lax (@supabase/ssr), so browsers do
//      not attach them to cross-site POST/PATCH/DELETE — CSRF against the
//      renewals/profile mutation routes is blocked at the cookie layer.
//   3. Money-adjacent routes (/api/checkout, /api/billing/portal,
//      /api/auth/signout) ADDITIONALLY enforce explicit Origin/Host checks as
//      defense in depth; /api/webhooks/stripe authenticates via signature.
// Do not add permissive CORS headers here.

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}

export default nextConfig
