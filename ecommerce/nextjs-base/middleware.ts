import createIntlMiddleware from 'next-intl/middleware'
import { routing } from './src/i18n/routing'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const intlMiddleware = createIntlMiddleware(routing)

function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  // Use btoa + fromCharCode — Buffer is not available in Edge Runtime (middleware)
  return btoa(String.fromCharCode(...bytes))
}

function buildCsp(nonce: string): string {
  const strapiOrigin = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337'
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || process.env.NEXT_PUBLIC_ALLOWED_ORIGINS
  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const isProd = process.env.NODE_ENV === 'production'

  const frameAncestorParts = [`'self'`, strapiOrigin]
  if (allowedOriginsEnv) {
    allowedOriginsEnv.split(',').map((s) => s.trim()).filter(Boolean).forEach((u) => frameAncestorParts.push(u))
  } else {
    frameAncestorParts.push(siteOrigin)
  }

  const directives = [
    "default-src 'self'",
    // Cloudinary images + Stripe fraud detection pixel
    `img-src 'self' data: https://res.cloudinary.com https://q.stripe.com ${strapiOrigin}`,
    // Nonce replaces 'unsafe-inline'; unsafe-eval only kept in dev for Fast Refresh
    // Stripe.js must load from its CDN for PCI compliance
    `script-src 'self' 'nonce-${nonce}' https://js.stripe.com${isProd ? '' : " 'unsafe-eval'"}`,
    "style-src 'self'",
    "style-src-attr 'unsafe-inline'",
    // Stripe API calls + Strapi
    `connect-src 'self' ${strapiOrigin} https://api.stripe.com https://r.stripe.com`,
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Stripe 3DS / card element iframes
    `frame-src 'self' https://js.stripe.com https://hooks.stripe.com`,
    `frame-ancestors ${frameAncestorParts.join(' ')}`,
    'upgrade-insecure-requests',
  ]

  return directives.join('; ')
}

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Stripe CLI often forwards to /webhook in local dev: keep it out of locale middleware.
  if (pathname === '/webhook' || pathname === '/webhook/') {
    return NextResponse.next()
  }

  // Generate a per-request nonce for CSP.
  const nonce = generateNonce()
  const csp = buildCsp(nonce)

  // Run intl middleware first to get its routing decision (locale redirect / cookie).
  const intlResponse = intlMiddleware(req)
  const intlStatus = intlResponse.status

  // If intl wants to redirect (missing locale prefix, etc.), preserve it and add CSP.
  if (intlStatus === 301 || intlStatus === 302 || intlStatus === 307 || intlStatus === 308) {
    intlResponse.headers.set('Content-Security-Policy', csp)
    return intlResponse
  }

  // Forward nonce to Server Components via request headers.
  // NextResponse.next({ request: { headers } }) is the only mechanism Next.js uses
  // to pass middleware-set data to the RSC render (read via `headers()` in layout).
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  // Preserve cookies and other headers set by intl middleware (e.g. NEXT_LOCALE).
  intlResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'content-security-policy') {
      response.headers.append(key, value)
    }
  })

  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  // Match all request paths except for Next.js internals, API routes, webhook, and static files
  matcher: ['/((?!api|webhook|_next|_vercel|.*\\..*).*)'],
}

