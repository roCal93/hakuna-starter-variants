import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIpFromHeaders } from '@/lib/rate-limit'

const STRAPI_URL =
  process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || ''
const BUNNY_CDN_URL = process.env.BUNNY_CDN_URL || ''

function getAllowedHostnames(): string[] {
  const hosts: string[] = ['localhost', '127.0.0.1']

  for (const rawUrl of [STRAPI_URL, BUNNY_CDN_URL]) {
    if (!rawUrl) continue
    try {
      const { hostname } = new URL(rawUrl)
      if (hostname) hosts.push(hostname)
    } catch {}
  }

  return hosts
}

export async function GET(request: NextRequest) {
  const clientIp = getClientIpFromHeaders(request.headers)
  const rateLimit = await checkRateLimit({
    key: `download:${clientIp}`,
    limit: 200,
    windowMs: 10 * 60 * 1000,
  })

  if (!rateLimit.allowed) {
    return new NextResponse('Too many requests', { status: 429 })
  }

  const { searchParams } = new URL(request.url)
  const rawUrl = searchParams.get('url')
  const rawName = searchParams.get('name') || 'download'
  const safeName = rawName.replace(/[^\w\-. ]/g, '_').slice(0, 200)

  if (!rawUrl) {
    return new NextResponse('Missing url', { status: 400 })
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    return new NextResponse('Invalid URL', { status: 400 })
  }

  const isLocalhost = ['localhost', '127.0.0.1'].includes(parsedUrl.hostname)

  if (
    parsedUrl.protocol !== 'https:' &&
    !(parsedUrl.protocol === 'http:' && isLocalhost)
  ) {
    return new NextResponse('Only HTTPS URLs allowed', { status: 400 })
  }

  // Prevent SSRF: hostname must be from a known allowed source
  if (!getAllowedHostnames().includes(parsedUrl.hostname)) {
    return new NextResponse('URL host not allowed', { status: 403 })
  }

  let upstream: Response
  try {
    upstream = await fetch(rawUrl, { cache: 'no-store' })
  } catch {
    return new NextResponse('Failed to fetch', { status: 502 })
  }

  if (!upstream.ok) {
    return new NextResponse('Upstream error', { status: upstream.status })
  }

  const contentType =
    upstream.headers.get('content-type') || 'application/octet-stream'

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      'Cache-Control': 'private, no-store',
    },
  })
}
