import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateStrapiUser } from '@/lib/strapi-login'
import {
  getStrapiSessionCookieOptions,
  STRAPI_SESSION_COOKIE,
} from '@/lib/strapi-session-cookie'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
  }

  const result = await authenticateStrapiUser(
    parsed.data.email.trim().toLowerCase(),
    parsed.data.password
  )

  if (!result?.jwt) {
    return NextResponse.json(
      { error: 'Email ou mot de passe incorrect.' },
      { status: 401 }
    )
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set({
    name: STRAPI_SESSION_COOKIE,
    value: result.jwt,
    ...getStrapiSessionCookieOptions(),
  })

  return response
}
