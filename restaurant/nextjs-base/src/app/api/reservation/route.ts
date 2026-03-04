import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { validateReservationInput } from '@/lib/reservation-validation'
import {
  buildCustomerPendingEmail,
  buildRestaurantNewReservationEmail,
  normalizeReservationLocale,
} from '@/lib/reservation-emails'
import { signReservationDecisionToken } from '@/lib/reservation-decision-token'

// Rate limiting simple en mémoire
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 3 // Max 3 soumissions
const RATE_LIMIT_WINDOW = 10 * 60 * 1000 // 10 minutes
const slotLocks = new Map<string, Promise<void>>()

async function withSlotLock<T>(slotKey: string, task: () => Promise<T>) {
  const previousLock = slotLocks.get(slotKey) || Promise.resolve()
  let releaseLock: () => void = () => {}
  const currentLock = new Promise<void>((resolve) => {
    releaseLock = resolve
  })

  slotLocks.set(
    slotKey,
    previousLock
      .catch(() => {
        return
      })
      .then(() => currentLock)
  )

  await previousLock.catch(() => {
    return
  })

  try {
    return await task()
  } finally {
    releaseLock()
    if (slotLocks.get(slotKey) === currentLock) {
      slotLocks.delete(slotKey)
    }
  }
}

// Nettoyage périodique de la map
setInterval(() => {
  const now = Date.now()
  for (const [ip, data] of rateLimitMap.entries()) {
    if (now > data.resetTime) {
      rateLimitMap.delete(ip)
    }
  }
}, 60 * 1000)

// Sanitization HTML
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '/': '&#x2F;',
  }
  return text.replace(/[&<>"'\/]/g, (char) => map[char] || char)
}

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      firstName,
      lastName,
      phone,
      email,
      date,
      time,
      covers,
      message,
      consent,
      locale,
      website, // honeypot
    } = body

    // 1. Protection Honeypot
    if (website) {
      console.warn('Bot detected via honeypot (reservation)')
      return NextResponse.json(
        { message: 'Réservation envoyée avec succès !' },
        { status: 200 }
      )
    }

    // 2. Rate Limiting par IP
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'
    const now = Date.now()
    const rateLimitData = rateLimitMap.get(ip)

    if (rateLimitData) {
      if (now < rateLimitData.resetTime) {
        if (rateLimitData.count >= RATE_LIMIT) {
          return NextResponse.json(
            {
              error:
                'Trop de tentatives. Veuillez réessayer dans quelques minutes.',
            },
            { status: 429 }
          )
        }
        rateLimitData.count++
      } else {
        rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
      }
    } else {
      rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    }

    const validation = validateReservationInput({
      firstName,
      lastName,
      phone,
      email,
      date,
      time,
      covers,
      consent,
    })
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const valid = validation.data

    // 6. Sanitization
    const sanitizedFirstName = escapeHtml(valid.firstName)
    const sanitizedLastName = escapeHtml(valid.lastName)
    const sanitizedPhone = escapeHtml(valid.phone)
    const sanitizedEmail = escapeHtml(valid.email)
    const sanitizedMessage = message ? escapeHtml(message.trim()) : ''
    const coversInt = valid.covers
    const reservationDate = valid.date
    const reservationTime = valid.time
    const reservationLocale = normalizeReservationLocale(locale)
    const companyName = process.env.COMPANY_NAME || 'Le restaurant'

    const strapiUrl =
      process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337'
    const strapiToken = process.env.STRAPI_API_TOKEN

    if (!strapiToken) {
      console.error('STRAPI_API_TOKEN not configured. Reservation aborted.')
      return NextResponse.json(
        {
          error:
            'Le service de réservation est temporairement indisponible. Veuillez réessayer plus tard.',
        },
        { status: 503 }
      )
    }

    const slotKey = `${reservationDate}::${reservationTime}`
    const reservationWriteResult = await withSlotLock(slotKey, async () => {
      const blockedRes = await fetch(
        `${strapiUrl}/api/blocked-slots?filters[date][$eq]=${reservationDate}&pagination[pageSize]=100`,
        {
          headers: { Authorization: `Bearer ${strapiToken}` },
          cache: 'no-store',
        }
      )

      if (!blockedRes.ok) {
        console.error('Strapi blocked-slots read error:', blockedRes.status)
        return { ok: false as const, status: 503, error: 'SERVICE_UNAVAILABLE' }
      }

      const blockedData = await blockedRes.json()
      const blockedList: Array<{ date: string; time: string | null }> =
        blockedData.data || []

      if (blockedList.some((s) => !s.time)) {
        return { ok: false as const, status: 400, error: 'DAY_BLOCKED' }
      }

      if (blockedList.some((s) => s.time === reservationTime)) {
        return { ok: false as const, status: 400, error: 'SLOT_BLOCKED' }
      }

      const [configRes, existingRes] = await Promise.all([
        fetch(`${strapiUrl}/api/reservation-config`, {
          headers: { Authorization: `Bearer ${strapiToken}` },
          cache: 'no-store',
        }),
        fetch(
          `${strapiUrl}/api/reservations?filters[date][$eq]=${reservationDate}&filters[time][$eq]=${reservationTime}&filters[status][$ne]=cancelled&pagination[pageSize]=200`,
          {
            headers: { Authorization: `Bearer ${strapiToken}` },
            cache: 'no-store',
          }
        ),
      ])

      if (!existingRes.ok) {
        console.error('Strapi reservations read error:', existingRes.status)
        return { ok: false as const, status: 503, error: 'SERVICE_UNAVAILABLE' }
      }

      const maxCoversPerSlot = configRes.ok
        ? ((await configRes.json())?.data?.maxCoversPerSlot ?? 20)
        : 20

      const existingData = await existingRes.json()
      const existingCovers: number = (existingData.data || []).reduce(
        (sum: number, r: { covers: number }) => sum + (r.covers || 0),
        0
      )

      if (existingCovers + coversInt > maxCoversPerSlot) {
        return { ok: false as const, status: 400, error: 'CAPACITY_EXCEEDED' }
      }

      const strapiResponse = await fetch(`${strapiUrl}/api/reservations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${strapiToken}`,
        },
        body: JSON.stringify({
          data: {
            firstName: sanitizedFirstName,
            lastName: sanitizedLastName,
            phone: sanitizedPhone,
            email: sanitizedEmail,
            date: reservationDate,
            time: reservationTime,
            covers: coversInt,
            message: sanitizedMessage,
            status: 'pending',
          },
        }),
      })

      if (!strapiResponse.ok) {
        const errorData = await strapiResponse.json().catch(() => ({}))
        console.error('Strapi reservation creation error:', errorData)
        return { ok: false as const, status: 500, error: 'CREATE_FAILED' }
      }

      const createdReservation = await strapiResponse.json()

      return {
        ok: true as const,
        status: 200,
        documentId: createdReservation?.data?.documentId,
      }
    })

    if (!reservationWriteResult.ok) {
      if (reservationWriteResult.error === 'DAY_BLOCKED') {
        return NextResponse.json(
          { error: "Ce jour n'est pas disponible pour les réservations." },
          { status: 400 }
        )
      }
      if (reservationWriteResult.error === 'SLOT_BLOCKED') {
        return NextResponse.json(
          { error: "Ce créneau horaire n'est pas disponible." },
          { status: 400 }
        )
      }
      if (reservationWriteResult.error === 'CAPACITY_EXCEEDED') {
        return NextResponse.json(
          {
            error:
              "Ce créneau n'a plus de disponibilité pour le nombre de couverts demandé.",
          },
          { status: 400 }
        )
      }
      if (reservationWriteResult.error === 'SERVICE_UNAVAILABLE') {
        return NextResponse.json(
          {
            error:
              'Le service de réservation est temporairement indisponible. Veuillez réessayer plus tard.',
          },
          { status: 503 }
        )
      }
      return NextResponse.json(
        { error: "Erreur lors de l'enregistrement de la réservation." },
        { status: reservationWriteResult.status }
      )
    }

    // 7. Envoi email si Resend est configuré
    if (!resend) {
      console.warn('Resend API key not configured. Email not sent.')
      return NextResponse.json(
        {
          success: true,
          message: 'Réservation enregistrée (mode démo - email non envoyé)',
        },
        { status: 200 }
      )
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin
    const confirmToken = reservationWriteResult.documentId
      ? signReservationDecisionToken(
          reservationWriteResult.documentId,
          'confirmed'
        )
      : null
    const cancelToken = reservationWriteResult.documentId
      ? signReservationDecisionToken(
          reservationWriteResult.documentId,
          'cancelled'
        )
      : null

    const decisionLinks =
      confirmToken && cancelToken
        ? {
            confirmUrl: `${siteUrl}/api/reservation/decision?token=${encodeURIComponent(confirmToken)}`,
            cancelUrl: `${siteUrl}/api/reservation/decision?token=${encodeURIComponent(cancelToken)}`,
          }
        : undefined

    const restaurantEmail = buildRestaurantNewReservationEmail(
      {
        firstName: sanitizedFirstName,
        lastName: sanitizedLastName,
        email: sanitizedEmail,
        phone: sanitizedPhone,
        date: reservationDate,
        time: reservationTime,
        covers: coversInt,
        message: sanitizedMessage,
      },
      reservationLocale,
      decisionLinks
    )

    const customerPendingEmail = buildCustomerPendingEmail(
      {
        firstName: sanitizedFirstName,
        date: reservationDate,
        time: reservationTime,
        covers: coversInt,
      },
      reservationLocale,
      companyName
    )

    // Email de notification au restaurant
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: process.env.CONTACT_EMAIL || 'contact@votre-domaine.com',
      replyTo: sanitizedEmail,
      subject: restaurantEmail.subject,
      html: restaurantEmail.html,
    })

    // Email de confirmation au client
    await resend.emails.send({
      from: `${companyName} <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`,
      to: sanitizedEmail,
      subject: customerPendingEmail.subject,
      html: customerPendingEmail.html,
    })

    return NextResponse.json(
      { message: 'Réservation enregistrée avec succès !' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Erreur serveur (reservation):', error)
    return NextResponse.json(
      { error: 'Erreur serveur interne.' },
      { status: 500 }
    )
  }
}
