import { NextRequest, NextResponse } from 'next/server'
import { STRAPI_SESSION_COOKIE } from '@/lib/strapi-session-cookie'

const AUTH_COOKIE_NAMES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
  'authjs.callback-url',
  '__Secure-authjs.callback-url',
  'authjs.csrf-token',
  '__Host-authjs.csrf-token',
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
  'next-auth.callback-url',
  '__Secure-next-auth.callback-url',
  'next-auth.csrf-token',
  '__Host-next-auth.csrf-token',
  STRAPI_SESSION_COOKIE,
]

function isAuthCookieName(name: string) {
  if (AUTH_COOKIE_NAMES.includes(name)) return true

  return AUTH_COOKIE_NAMES.some((baseName) => name.startsWith(`${baseName}.`))
}

function buildExpireOptions(name: string) {
  return {
    name,
    value: '',
    path: '/',
    maxAge: 0,
    secure: name.startsWith('__Secure-') || name.startsWith('__Host-'),
  }
}

function supportsDomainAttribute(name: string) {
  return !name.startsWith('__Host-')
}

function getCookieDomains(hostname: string) {
  if (!hostname || hostname === 'localhost' || !hostname.includes('.')) {
    return [] as string[]
  }

  if (hostname.startsWith('www.')) {
    return [hostname.slice(4)]
  }

  return [hostname]
}

function buildExpireHeader(name: string, domain?: string): string {
  const secure =
    name.startsWith('__Secure-') || name.startsWith('__Host-') ? '; Secure' : ''
  const domainPart = domain ? `; Domain=${domain}` : ''
  return `${name}=; Path=/; Max-Age=0${domainPart}${secure}; HttpOnly; SameSite=Lax`
}

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true })
  const authCookieNames = request.cookies
    .getAll()
    .map((cookie) => cookie.name)
    .filter(isAuthCookieName)
  const cookieDomains = getCookieDomains(request.nextUrl.hostname)

  if (authCookieNames.length === 0) {
    return response
  }

  for (const name of authCookieNames) {
    // No-domain deletion (covers cookies set by Auth.js on www. hosts)
    response.headers.append('Set-Cookie', buildExpireHeader(name))

    if (!supportsDomainAttribute(name)) {
      continue
    }

    // Domain-scoped deletion (covers cookies set on the apex domain)
    // Uses headers.append instead of cookies.set so both Set-Cookie headers
    // are emitted — cookies.set deduplicates by name and would drop the first.
    for (const domain of cookieDomains) {
      response.headers.append('Set-Cookie', buildExpireHeader(name, domain))
    }
  }

  return response
}
