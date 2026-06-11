import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import { getStrapiSessionJwt } from '@/lib/strapi-session-cookie'

const schema = z.object({
  currentPassword: z.string().min(1),
  password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule')
    .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre'),
  passwordConfirmation: z.string().min(1),
})

export async function PUT(req: NextRequest) {
  const session = await auth()
  const strapiJwt = await getStrapiSessionJwt()
  if (!session || !strapiJwt) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
  }

  if (parsed.data.password !== parsed.data.passwordConfirmation) {
    return NextResponse.json(
      { error: 'Les mots de passe ne correspondent pas' },
      { status: 400 }
    )
  }

  const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL
  const res = await fetch(`${strapiUrl}/api/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${strapiJwt}`,
    },
    body: JSON.stringify({
      currentPassword: parsed.data.currentPassword,
      password: parsed.data.password,
      passwordConfirmation: parsed.data.passwordConfirmation,
    }),
  })

  const json = await res.json()

  if (!res.ok) {
    const msg =
      (json as { error?: { message?: string } })?.error?.message ??
      'Mot de passe actuel incorrect'
    return NextResponse.json({ error: msg }, { status: res.status })
  }

  return NextResponse.json({ ok: true })
}
