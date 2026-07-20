import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

// ─── Rate limiting ────────────────────────────────────────────────────────────
const rsvpRateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RSVP_RATE_LIMIT = 10 // max soumissions par IP
const RSVP_RATE_WINDOW = 15 * 60 * 1000 // 15 minutes

setInterval(() => {
  const now = Date.now()
  for (const [ip, data] of rsvpRateLimitMap.entries()) {
    if (now > data.resetTime) rsvpRateLimitMap.delete(ip)
  }
}, 60 * 1000)

// ─── HTML escape (protège l'email de notification contre l'injection HTML) ───
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '/': '&#x2F;',
  }
  return text.replace(/[&<>"'/]/g, (c) => map[c] || c)
}

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337'
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || ''

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token) {
    return NextResponse.json({ error: 'Token manquant' }, { status: 400 })
  }

  // Rate limiting par IP
  const ip =
    request.headers.get('x-forwarded-for') ??
    request.headers.get('x-real-ip') ??
    'unknown'
  const now = Date.now()
  const rl = rsvpRateLimitMap.get(ip)
  if (rl) {
    if (now < rl.resetTime) {
      if (rl.count >= RSVP_RATE_LIMIT) {
        return NextResponse.json(
          { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
          { status: 429 }
        )
      }
      rl.count++
    } else {
      rsvpRateLimitMap.set(ip, { count: 1, resetTime: now + RSVP_RATE_WINDOW })
    }
  } else {
    rsvpRateLimitMap.set(ip, { count: 1, resetTime: now + RSVP_RATE_WINDOW })
  }

  let body: {
    status: string
    partnerAttending?: boolean
    message?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Corps de requête invalide' },
      { status: 400 }
    )
  }

  // Validate status
  if (!['attending', 'declining'].includes(body.status)) {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
  }

  // Forward RSVP to Strapi custom endpoint
  const strapiRes = await fetch(
    `${STRAPI_URL}/api/guests/by-token/${token}/rsvp`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(STRAPI_API_TOKEN
          ? { Authorization: `Bearer ${STRAPI_API_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(body),
    }
  )

  if (!strapiRes.ok) {
    const err = await strapiRes.text()
    console.error('[RSVP] Strapi error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour' },
      { status: strapiRes.status }
    )
  }

  const strapiData = await strapiRes.json()

  // Fetch guest + wedding details for the notification email
  const guestRes = await fetch(`${STRAPI_URL}/api/guests/by-token/${token}`, {
    headers: {
      ...(STRAPI_API_TOKEN
        ? { Authorization: `Bearer ${STRAPI_API_TOKEN}` }
        : {}),
    },
  })

  // Send notification email — fire-and-forget: email failure must never block the RSVP response
  if (guestRes.ok && resend) {
    try {
      const { data: guest } = await guestRes.json()
      const wedding = guest?.wedding

      const organizerEmail = process.env.WEDDING_ORGANIZER_EMAIL

      if (organizerEmail) {
        const guestDisplayName = guest.name2
          ? `${guest.name1} & ${guest.name2}`
          : guest.name1

        const statusLabel =
          body.status === 'attending' ? '✅ Présent(e)' : '❌ Absent(e)'

        const emailHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #1a1a1a;">Nouvelle réponse RSVP — ${
              wedding?.eventName ?? 'Mariage'
            }</h2>
            <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
              <tr>
                <td style="padding: 8px; font-weight: bold; color: #555;">Invité</td>
                <td style="padding: 8px;">${guestDisplayName}</td>
              </tr>
              <tr style="background: #f9f9f9;">
                <td style="padding: 8px; font-weight: bold; color: #555;">Réponse</td>
                <td style="padding: 8px;">${statusLabel}</td>
              </tr>
              ${
                guest.askPartnerAttendance && guest.name2
                  ? `
              <tr>
                <td style="padding: 8px; font-weight: bold; color: #555;">${guest.name2} présent(e) ?</td>
                <td style="padding: 8px;">${body.partnerAttending === true ? '\u2705 Oui' : body.partnerAttending === false ? '\u274c Non' : '—'}</td>
              </tr>`
                  : ''
              }
              ${
                body.message
                  ? `
              <tr style="background: #f9f9f9;">
                <td style="padding: 8px; font-weight: bold; color: #555;">Message</td>
                <td style="padding: 8px; font-style: italic;">"${escapeHtml(body.message ?? '')}"</td>
              </tr>`
                  : ''
              }
            </table>
            <p style="margin-top: 24px; font-size: 13px; color: #999;">
              Répondu le ${new Date().toLocaleDateString('fr-FR', { dateStyle: 'full' })}
            </p>
          </div>
        `

        await resend.emails.send({
          from:
            process.env.RESEND_FROM_EMAIL ||
            'RSVP <rsvp@notifications.wedding-rsvp.fr>',
          to: organizerEmail,
          subject: `Mariage — ${guestDisplayName} : ${body.status === 'attending' ? 'Présent(e) 🎉' : 'Absent(e)'}`,
          html: emailHtml,
        })
      }
    } catch (emailErr) {
      // Non-blocking: log but do not fail the RSVP response
      console.error('[RSVP] Email notification failed:', emailErr)
    }
  }

  return NextResponse.json({ success: true, data: strapiData })
}
