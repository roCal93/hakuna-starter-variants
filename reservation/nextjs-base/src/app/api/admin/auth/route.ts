import { NextRequest, NextResponse } from 'next/server'
import { signToken, verifyToken, COOKIE_NAME } from '@/lib/admin-auth'
import { enforceSameOrigin } from '@/lib/csrf'

const COOKIE_MAX_AGE = 8 * 60 * 60 // 8h in seconds
const LOGIN_RATE_LIMIT = 5
const LOGIN_RATE_LIMIT_WINDOW = 15 * 60 * 1000
const loginAttempts = new Map<string, { count: number; resetTime: number }>()

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown'
  }
  return request.headers.get('x-real-ip') || 'unknown'
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = loginAttempts.get(ip)

  if (!entry) return false
  if (now > entry.resetTime) {
    loginAttempts.delete(ip)
    return false
  }

  return entry.count >= LOGIN_RATE_LIMIT
}

function bumpLoginAttempt(ip: string) {
  const now = Date.now()
  const entry = loginAttempts.get(ip)

  if (!entry || now > entry.resetTime) {
    loginAttempts.set(ip, {
      count: 1,
      resetTime: now + LOGIN_RATE_LIMIT_WINDOW,
    })
    return
  }

  entry.count++
}

function clearLoginAttempts(ip: string) {
  loginAttempts.delete(ip)
}

export async function POST(request: NextRequest) {
  const csrfError = enforceSameOrigin(request)
  if (csrfError) return csrfError

  try {
    const ip = getClientIp(request)
    const body = await request.json()
    const { username, password, action } = body

    // Logout
    if (action === 'logout') {
      const res = NextResponse.json({ ok: true })
      res.cookies.set(COOKIE_NAME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      })
      return res
    }

    // Login
    const expectedUsername = process.env.ADMIN_USERNAME
    const expectedPassword = process.env.ADMIN_PASSWORD
    const adminSecret = process.env.ADMIN_SECRET

    if (!expectedUsername || !expectedPassword || !adminSecret) {
      return NextResponse.json(
        { error: 'Admin credentials not configured.' },
        { status: 500 }
      )
    }

    if (isRateLimited(ip)) {
      return NextResponse.json(
        {
          error:
            'Trop de tentatives de connexion. Veuillez réessayer dans quelques minutes.',
        },
        { status: 429 }
      )
    }

    if (username !== expectedUsername || password !== expectedPassword) {
      bumpLoginAttempt(ip)
      return NextResponse.json(
        { error: 'Identifiants incorrects.' },
        { status: 401 }
      )
    }

    clearLoginAttempts(ip)
    const token = signToken(username)
    const res = NextResponse.json({ ok: true })
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    })
    return res
  } catch {
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

// Verify current session
export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value
  const user = verifyToken(token)
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
  return NextResponse.json({ authenticated: true, username: user })
}
