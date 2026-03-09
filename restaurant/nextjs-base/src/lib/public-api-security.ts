import { NextRequest, NextResponse } from 'next/server'

function getAllowedOrigins(request: NextRequest): Set<string> {
  const allowed = new Set<string>()
  allowed.add(request.nextUrl.origin)

  const envList = process.env.PUBLIC_API_ALLOWED_ORIGINS || ''
  for (const item of envList.split(',')) {
    const origin = item.trim()
    if (origin) {
      allowed.add(origin.replace(/\/$/, ''))
    }
  }

  return allowed
}

export function enforcePublicApiOrigin(
  request: NextRequest
): NextResponse | null {
  const allowedOrigins = getAllowedOrigins(request)
  const origin = request.headers.get('origin')?.replace(/\/$/, '')

  if (origin && !allowedOrigins.has(origin)) {
    return NextResponse.json(
      { error: 'Origine non autorisee.' },
      { status: 403 }
    )
  }

  const referer = request.headers.get('referer')
  if (!origin && referer) {
    let refererOrigin = ''
    try {
      refererOrigin = new URL(referer).origin.replace(/\/$/, '')
    } catch {
      return NextResponse.json(
        { error: 'Referent non autorise.' },
        { status: 403 }
      )
    }

    if (!allowedOrigins.has(refererOrigin)) {
      return NextResponse.json(
        { error: 'Referent non autorise.' },
        { status: 403 }
      )
    }
  }

  return null
}