import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import {
  buildCustomerStatusEmail,
  normalizeReservationLocale,
} from '@/lib/reservation-emails'
import { verifyReservationDecisionToken } from '@/lib/reservation-decision-token'

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

function htmlPage(title: string, message: string, color: string) {
  return `
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
      </head>
      <body style="margin:0;padding:24px;font-family:Arial,sans-serif;background:#f3f4f6;color:#111827;">
        <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
          <h1 style="margin:0 0 12px;color:${color};font-size:24px;">${title}</h1>
          <p style="margin:0;line-height:1.5;">${message}</p>
        </div>
      </body>
    </html>
  `
}

export async function GET(request: NextRequest) {
  if (!STRAPI_URL || !STRAPI_TOKEN) {
    return new NextResponse(
      htmlPage(
        'Service indisponible',
        'Configuration serveur incomplète. Impossible de traiter cette demande.',
        '#dc2626'
      ),
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  const token = request.nextUrl.searchParams.get('token')
  const decision = verifyReservationDecisionToken(token)

  if (!decision) {
    return new NextResponse(
      htmlPage(
        'Lien invalide',
        'Ce lien de décision est invalide ou expiré.',
        '#dc2626'
      ),
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  const currentRes = await fetch(`${STRAPI_URL}/api/reservations/${decision.id}`, {
    headers: strapiHeaders(),
    cache: 'no-store',
  })

  if (!currentRes.ok) {
    return new NextResponse(
      htmlPage(
        'Réservation introuvable',
        "Impossible de retrouver cette réservation. Elle a peut-être déjà été traitée.",
        '#dc2626'
      ),
      {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    )
  }

  const currentData = await currentRes.json()
  const reservation = currentData?.data

  if (!reservation) {
    return new NextResponse(
      htmlPage('Réservation introuvable', 'Aucune donnée associée à ce lien.', '#dc2626'),
      {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    )
  }

  if (reservation.status === decision.status) {
    return new NextResponse(
      htmlPage(
        'Action déjà appliquée',
        decision.status === 'confirmed'
          ? 'Cette réservation a déjà été confirmée.'
          : 'Cette réservation a déjà été refusée.',
        '#2563eb'
      ),
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  const updateRes = await fetch(`${STRAPI_URL}/api/reservations/${decision.id}`, {
    method: 'PUT',
    headers: strapiHeaders(),
    body: JSON.stringify({ data: { status: decision.status } }),
  })

  if (!updateRes.ok) {
    return new NextResponse(
      htmlPage(
        'Erreur de mise à jour',
        'La mise à jour du statut a échoué. Réessayez depuis votre espace admin.',
        '#dc2626'
      ),
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  if (resend && reservation.email) {
    const locale = normalizeReservationLocale(reservation.locale)
    const companyName = process.env.COMPANY_NAME || 'Le restaurant'

    const customerStatusEmail = buildCustomerStatusEmail(
      decision.status,
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
      console.error('Erreur envoi email statut réservation (lien mail):', error)
    }
  }

  return new NextResponse(
    htmlPage(
      decision.status === 'confirmed' ? 'Réservation confirmée' : 'Réservation refusée',
      decision.status === 'confirmed'
        ? 'Le statut a été mis à jour et le client a été notifié.'
        : 'Le statut a été mis à jour et le client a été notifié.',
      '#16a34a'
    ),
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}
