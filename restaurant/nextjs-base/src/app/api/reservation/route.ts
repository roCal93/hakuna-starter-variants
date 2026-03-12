import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { validateReservationInput } from '@/lib/reservation-validation'
import {
  buildCustomerPendingEmail,
  buildRestaurantNewReservationEmail,
  normalizeReservationLocale,
} from '@/lib/reservation-emails'
import { signReservationDecisionToken } from '@/lib/reservation-decision-token'
import { checkRateLimit, getClientIpFromHeaders } from '@/lib/rate-limit'
import { enforcePublicApiOrigin } from '@/lib/public-api-security'
import { isReservationAllowed, type OpeningDayConfig } from '@/lib/opening-days'

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
    const originError = enforcePublicApiOrigin(request)
    if (originError) return originError

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

    // 2. Rate limiting (store distribue si UPSTASH_* configure, sinon fallback memoire)
    const ip = getClientIpFromHeaders(request.headers)
    const rateLimit = await checkRateLimit({
      key: `reservation:${ip}`,
      limit: RATE_LIMIT,
      windowMs: RATE_LIMIT_WINDOW,
    })

    if (!rateLimit.allowed) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
      )
      return NextResponse.json(
        {
          error: 'Trop de tentatives. Veuillez reessayer dans quelques minutes.',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSec),
            'X-RateLimit-Limit': String(RATE_LIMIT),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Source': rateLimit.source,
          },
        }
      )
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
    const strapiWriteToken =
      process.env.STRAPI_WRITE_API_TOKEN || process.env.STRAPI_API_TOKEN

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

    if (!strapiWriteToken) {
      console.error(
        'STRAPI_WRITE_API_TOKEN not configured. Reservation creation aborted.'
      )
      return NextResponse.json(
        {
          error:
            'Le service de reservation est temporairement indisponible. Veuillez reessayer plus tard.',
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
        fetch(`${strapiUrl}/api/reservation-config?populate=openingDays`, {
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

      let maxCoversPerSlot = 20
      let configOpeningDays: OpeningDayConfig[] = []
      if (configRes.ok) {
        const configData = await configRes.json()
        maxCoversPerSlot = configData?.data?.maxCoversPerSlot ?? 20
        configOpeningDays = configData?.data?.openingDays ?? []
      }

      if (
        !isReservationAllowed(
          reservationDate,
          reservationTime,
          configOpeningDays
        )
      ) {
        return {
          ok: false as const,
          status: 400,
          error: 'DAY_OR_TIME_NOT_ALLOWED',
        }
      }

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
          Authorization: `Bearer ${strapiWriteToken}`,
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
        const status = strapiResponse.status
        const errorData = await strapiResponse.json().catch(() => ({}))
        console.error('Strapi reservation creation error:', {
          status,
          statusText: strapiResponse.statusText,
          errorData,
        })

        if (status === 401 || status === 403) {
          return { ok: false as const, status: 503, error: 'STRAPI_FORBIDDEN' }
        }

        if (status === 400 || status === 422) {
          return { ok: false as const, status: 400, error: 'CREATE_INVALID' }
        }

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
      if (reservationWriteResult.error === 'DAY_OR_TIME_NOT_ALLOWED') {
        return NextResponse.json(
          {
            error:
              "Ce créneau n'est pas disponible selon les horaires d'ouverture.",
          },
          { status: 400 }
        )
      }
      if (reservationWriteResult.error === 'CREATE_INVALID') {
        return NextResponse.json(
          {
            error:
              "Impossible d'enregistrer la reservation avec les informations envoyees.",
          },
          { status: 400 }
        )
      }
      if (reservationWriteResult.error === 'STRAPI_FORBIDDEN') {
        return NextResponse.json(
          {
            error:
              'Le service de reservation est temporairement indisponible. Veuillez reessayer plus tard.',
          },
          { status: 503 }
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
