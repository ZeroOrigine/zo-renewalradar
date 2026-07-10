// CANONICAL: next.config.mjs — security headers + explicit CORS stance.
// CORS: this API is same-origin only. We deliberately send NO
// Access-Control-Allow-Origin header (browsers block cross-origin reads by
// default), and every state-changing route additionally enforces Origin/Host
// checks. Do not add permissive CORS here.

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
