import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { verifyToken, COOKIE_NAME } from '@/lib/admin-auth'
import { enforceSameOrigin } from '@/lib/csrf'
import {
  buildCustomerStatusEmail,
  normalizeReservationLocale,
} from '@/lib/reservation-emails'

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

function strapiHeaders() {
  return {
    Authorization: `Bearer ${STRAPI_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

function requireAdmin(request: NextRequest): string | null {
  const token = request.cookies.get(COOKIE_NAME)?.value
  return verifyToken(token)
}

// PATCH /api/admin/reservations/[id]  { status: 'confirmed' | 'cancelled' }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  }

  const csrfError = enforceSameOrigin(request)
  if (csrfError) return csrfError

  const { id } = await params
  const body = await request.json()
  const { status } = body

  if (!['confirmed', 'cancelled', 'pending'].includes(status)) {
    return NextResponse.json({ error: 'Statut invalide.' }, { status: 400 })
  }

  const currentRes = await fetch(`${STRAPI_URL}/api/reservations/${id}`, {
    headers: strapiHeaders(),
    cache: 'no-store',
  })

  if (!currentRes.ok) {
    return NextResponse.json(
      { error: 'Réservation introuvable.' },
      { status: currentRes.status }
    )
  }

  const currentData = await currentRes.json()
  const reservation = currentData?.data

  if (!reservation) {
    return NextResponse.json(
      { error: 'Réservation introuvable.' },
      { status: 404 }
    )
  }

  if (reservation.status === status) {
    return NextResponse.json({ ok: true, skippedEmail: true, data: reservation })
  }

  const res = await fetch(`${STRAPI_URL}/api/reservations/${id}`, {
    method: 'PUT',
    headers: strapiHeaders(),
    body: JSON.stringify({ data: { status } }),
  })

  if (!res.ok) {
    return NextResponse.json(
      { error: 'Erreur Strapi.' },
      { status: res.status }
    )
  }

  const data = await res.json()

  if (
    resend &&
    (status === 'confirmed' || status === 'cancelled') &&
    reservation.email
  ) {
    const locale = normalizeReservationLocale(reservation.locale)
    const companyName = process.env.COMPANY_NAME || 'Le restaurant'

    const customerStatusEmail = buildCustomerStatusEmail(
      status,
      {
        firstName: reservation.firstName || 'Client',
        date: reservation.date,
        time: reservation.time,
        covers: reservation.covers || 1,
      },
      locale,
      companyName
    )

    try {
      await resend.emails.send({
        from: `${companyName} <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`,
        to: reservation.email,
        subject: customerStatusEmail.subject,
        html: customerStatusEmail.html,
      })
    } catch (error) {
      console.error('Erreur envoi email statut réservation:', error)
    }
  }

  return NextResponse.json(data)
}
