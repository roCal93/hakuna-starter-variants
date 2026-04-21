export type ReservationLocale = 'fr' | 'en'

type ReservationEmailPayload = {
  firstName: string
  lastName: string
  email: string
  phone: string
  date: string
  time: string
  covers: number
  message?: string
}

type ReservationStatusPayload = {
  firstName: string
  date: string
  time: string
  covers: number
}

export function normalizeReservationLocale(value: unknown): ReservationLocale {
  if (typeof value !== 'string') return 'fr'
  const locale = value.toLowerCase()
  if (locale.startsWith('en')) return 'en'
  return 'fr'
}

function formatDateByLocale(date: string, locale: ReservationLocale): string {
  return new Date(date).toLocaleDateString(locale === 'en' ? 'en-GB' : 'fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function buildRestaurantNewReservationEmail(
  payload: ReservationEmailPayload,
  locale: ReservationLocale,
  actions?: { confirmUrl?: string; cancelUrl?: string }
): { subject: string; html: string } {
  const formattedDate = formatDateByLocale(payload.date, locale)
  const fullName = `${payload.firstName} ${payload.lastName}`

  const subject =
    locale === 'en'
      ? `New reservation request - ${fullName} - ${formattedDate} at ${payload.time}`
      : `Nouvelle demande de réservation - ${fullName} - ${formattedDate} à ${payload.time}`

  const messageLine = payload.message
    ? locale === 'en'
      ? `<p><strong>Message:</strong> ${payload.message}</p>`
      : `<p><strong>Message :</strong> ${payload.message}</p>`
    : ''

  const actionsLine =
    actions?.confirmUrl && actions?.cancelUrl
      ? locale === 'en'
        ? `
          <p style="margin-top:16px;">
            <a href="${actions.confirmUrl}" style="display:inline-block;padding:10px 14px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px;margin-right:8px;">Confirm</a>
            <a href="${actions.cancelUrl}" style="display:inline-block;padding:10px 14px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;">Refuse</a>
          </p>
        `
        : `
          <p style="margin-top:16px;">
            <a href="${actions.confirmUrl}" style="display:inline-block;padding:10px 14px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px;margin-right:8px;">Confirmer</a>
            <a href="${actions.cancelUrl}" style="display:inline-block;padding:10px 14px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;">Refuser</a>
          </p>
        `
      : ''

  const html =
    locale === 'en'
      ? `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:20px;color:#1f2937;">
        <h2 style="margin:0 0 12px;color:#111827;">🍽️ New reservation request</h2>
        <p><strong>Customer:</strong> ${fullName}</p>
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p><strong>Time:</strong> ${payload.time}</p>
        <p><strong>Covers:</strong> ${payload.covers}</p>
        <p><strong>Phone:</strong> ${payload.phone}</p>
        <p><strong>Email:</strong> ${payload.email}</p>
        ${messageLine}
        <p style="margin-top:16px;">Status: <strong>Pending confirmation</strong></p>
        ${actionsLine}
      </div>
    `
      : `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:20px;color:#1f2937;">
        <h2 style="margin:0 0 12px;color:#111827;">🍽️ Nouvelle demande de réservation</h2>
        <p><strong>Client :</strong> ${fullName}</p>
        <p><strong>Date :</strong> ${formattedDate}</p>
        <p><strong>Heure :</strong> ${payload.time}</p>
        <p><strong>Couverts :</strong> ${payload.covers}</p>
        <p><strong>Téléphone :</strong> ${payload.phone}</p>
        <p><strong>Email :</strong> ${payload.email}</p>
        ${messageLine}
        <p style="margin-top:16px;">Statut : <strong>En attente de confirmation</strong></p>
        ${actionsLine}
      </div>
    `

  return { subject, html }
}

export function buildCustomerPendingEmail(
  payload: ReservationStatusPayload,
  locale: ReservationLocale,
  companyName: string
): { subject: string; html: string } {
  const formattedDate = formatDateByLocale(payload.date, locale)

  if (locale === 'en') {
    return {
      subject: 'Your reservation request is pending',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:20px;color:#1f2937;">
          <h2 style="margin:0 0 12px;color:#111827;">Thank you for your reservation request</h2>
          <p>Hello ${payload.firstName},</p>
          <p>We received your request. It is currently <strong>pending confirmation</strong>.</p>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Time:</strong> ${payload.time}</p>
          <p><strong>Covers:</strong> ${payload.covers}</p>
          <p style="margin-top:16px;">We will confirm your reservation as soon as possible.</p>
          <p>Best regards,<br>${companyName}</p>
        </div>
      `,
    }
  }

  return {
    subject: 'Votre demande de réservation est en attente',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:20px;color:#1f2937;">
        <h2 style="margin:0 0 12px;color:#111827;">Merci pour votre demande de réservation</h2>
        <p>Bonjour ${payload.firstName},</p>
        <p>Nous avons bien reçu votre demande. Elle est actuellement <strong>en attente de confirmation</strong>.</p>
        <p><strong>Date :</strong> ${formattedDate}</p>
        <p><strong>Heure :</strong> ${payload.time}</p>
        <p><strong>Couverts :</strong> ${payload.covers}</p>
        <p style="margin-top:16px;">Nous revenons vers vous très rapidement pour confirmer votre réservation.</p>
        <p>Cordialement,<br>${companyName}</p>
      </div>
    `,
  }
}

export function buildCustomerStatusEmail(
  status: 'confirmed' | 'cancelled',
  payload: ReservationStatusPayload,
  locale: ReservationLocale,
  companyName: string
): { subject: string; html: string } {
  const formattedDate = formatDateByLocale(payload.date, locale)

  if (locale === 'en') {
    if (status === 'confirmed') {
      return {
        subject: 'Your reservation is confirmed',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:20px;color:#1f2937;">
            <h2 style="margin:0 0 12px;color:#111827;">✅ Reservation confirmed</h2>
            <p>Hello ${payload.firstName},</p>
            <p>Your reservation is now <strong>confirmed</strong>.</p>
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Time:</strong> ${payload.time}</p>
            <p><strong>Covers:</strong> ${payload.covers}</p>
            <p>We look forward to welcoming you.</p>
            <p>Best regards,<br>${companyName}</p>
          </div>
        `,
      }
    }

    return {
      subject: 'Update about your reservation request',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:20px;color:#1f2937;">
          <h2 style="margin:0 0 12px;color:#111827;">❌ Reservation unavailable</h2>
          <p>Hello ${payload.firstName},</p>
          <p>Unfortunately, we cannot confirm your reservation request for this slot.</p>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Time:</strong> ${payload.time}</p>
          <p><strong>Covers:</strong> ${payload.covers}</p>
          <p>Please contact us to find another option.</p>
          <p>Best regards,<br>${companyName}</p>
        </div>
      `,
    }
  }

  if (status === 'confirmed') {
    return {
      subject: 'Votre réservation est confirmée',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:20px;color:#1f2937;">
          <h2 style="margin:0 0 12px;color:#111827;">✅ Réservation confirmée</h2>
          <p>Bonjour ${payload.firstName},</p>
          <p>Votre réservation est maintenant <strong>confirmée</strong>.</p>
          <p><strong>Date :</strong> ${formattedDate}</p>
          <p><strong>Heure :</strong> ${payload.time}</p>
          <p><strong>Couverts :</strong> ${payload.covers}</p>
          <p>Nous avons hâte de vous accueillir.</p>
          <p>Cordialement,<br>${companyName}</p>
        </div>
      `,
    }
  }

  return {
    subject: 'Mise à jour de votre demande de réservation',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:20px;color:#1f2937;">
        <h2 style="margin:0 0 12px;color:#111827;">❌ Réservation indisponible</h2>
        <p>Bonjour ${payload.firstName},</p>
        <p>Nous sommes désolés, nous ne pouvons pas confirmer votre demande pour ce créneau.</p>
        <p><strong>Date :</strong> ${formattedDate}</p>
        <p><strong>Heure :</strong> ${payload.time}</p>
        <p><strong>Couverts :</strong> ${payload.covers}</p>
        <p>N’hésitez pas à nous contacter pour une autre proposition.</p>
        <p>Cordialement,<br>${companyName}</p>
      </div>
    `,
  }
}
