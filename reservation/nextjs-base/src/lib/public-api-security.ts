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

function normalizeOrigin(value: string | null): string | null {
  if (!value) return null

  try {
    return new URL(value).origin.replace(/\/$/, '')
  } catch {
    return null
  }
}

/**
 * Strict origin check for authenticated state-changing routes.
 * Requires either Origin or Referer to match the allowlist.
 */
export function enforceAuthenticatedMutationOrigin(
  request: NextRequest
): NextResponse | null {
  const allowedOrigins = getAllowedOrigins(request)
  const origin = request.headers.get('origin')?.replace(/\/$/, '') ?? null
  const refererOrigin = normalizeOrigin(request.headers.get('referer'))

  if (!origin && !refererOrigin) {
    return NextResponse.json({ error: 'Origine manquante.' }, { status: 403 })
  }

  if (origin && !allowedOrigins.has(origin)) {
    return NextResponse.json(
      { error: 'Origine non autorisee.' },
      { status: 403 }
    )
  }

  if (refererOrigin && !allowedOrigins.has(refererOrigin)) {
    return NextResponse.json(
      { error: 'Referent non autorise.' },
      { status: 403 }
    )
  }

  if (origin && refererOrigin && origin !== refererOrigin) {
    return NextResponse.json(
      { error: 'Conflit d origine de requete.' },
      { status: 403 }
    )
  }

  return null
}