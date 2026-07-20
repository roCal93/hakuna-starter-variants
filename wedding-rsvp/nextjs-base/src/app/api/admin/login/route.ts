import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const ADMIN_SECRET = process.env.ADMIN_SECRET

  // Guard: ADMIN_SECRET must be explicitly set — no default allowed
  if (!ADMIN_SECRET) {
    console.error('[Admin] ADMIN_SECRET is not set in environment variables')
    return NextResponse.json(
      { error: 'Administration non configurée. Définissez ADMIN_SECRET.' },
      { status: 503 }
    )
  }

  let body: { secret?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Corps de requête invalide' },
      { status: 400 }
    )
  }

  if (!body.secret || body.secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Secret invalide' }, { status: 401 })
  }

  const isProd = process.env.NODE_ENV === 'production'

  const response = NextResponse.json({ success: true })
  response.cookies.set('admin_auth', ADMIN_SECRET, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 heures
  })

  return response
}
