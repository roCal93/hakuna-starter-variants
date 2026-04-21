import { ALL_RESERVATION_SLOTS } from '@/lib/reservation-slots'

export type ReservationInput = {
  firstName: unknown
  lastName: unknown
  phone: unknown
  email: unknown
  date: unknown
  time: unknown
  covers: unknown
  consent: unknown
}

export type ReservationValidated = {
  firstName: string
  lastName: string
  phone: string
  email: string
  date: string
  time: string
  covers: number
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_REGEX = /^\+?[\d\s\-().]{6,20}$/

export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return !Number.isNaN(new Date(value).getTime())
}

export function isPastDate(value: string): boolean {
  // Compare as UTC date strings (YYYY-MM-DD) to avoid server-timezone drift at midnight
  const todayUTC = new Date().toISOString().slice(0, 10)
  return value < todayUTC
}

export function isValidReservationTime(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false
  return ALL_RESERVATION_SLOTS.includes(value)
}

export function isValidBlockedSlotInput(date: unknown, time: unknown): boolean {
  const dateValue = String(date || '').trim()
  if (!isValidDateString(dateValue) || isPastDate(dateValue)) return false

  if (time === undefined || time === null || time === '') return true

  const timeValue = String(time).trim()
  return isValidReservationTime(timeValue)
}

export function validateReservationInput(
  input: ReservationInput
): { ok: true; data: ReservationValidated } | { ok: false; error: string } {
  const firstName = String(input.firstName || '').trim()
  const lastName = String(input.lastName || '').trim()
  const phone = String(input.phone || '').trim()
  const email = String(input.email || '').trim()
  const date = String(input.date || '').trim()
  const time = String(input.time || '').trim()
  const coversRaw = String(input.covers || '').trim()
  const consent = input.consent

  if (
    !firstName ||
    !lastName ||
    !phone ||
    !email ||
    !date ||
    !time ||
    !coversRaw ||
    consent !== true
  ) {
    return {
      ok: false,
      error:
        'Tous les champs obligatoires doivent être remplis et le consentement accordé.',
    }
  }

  if (!EMAIL_REGEX.test(email)) {
    return { ok: false, error: 'Adresse email invalide.' }
  }

  if (!PHONE_REGEX.test(phone)) {
    return { ok: false, error: 'Numéro de téléphone invalide.' }
  }

  if (!isValidDateString(date)) {
    return { ok: false, error: 'Date invalide.' }
  }

  if (isPastDate(date)) {
    return { ok: false, error: 'La date ne peut pas être dans le passé.' }
  }

  if (!isValidReservationTime(time)) {
    return { ok: false, error: 'Créneau horaire invalide.' }
  }

  if (!/^\d+$/.test(coversRaw)) {
    return { ok: false, error: 'Nombre de couverts invalide.' }
  }

  const covers = Number(coversRaw)
  if (!Number.isInteger(covers) || covers < 1 || covers > 500) {
    return { ok: false, error: 'Nombre de couverts invalide.' }
  }

  return {
    ok: true,
    data: {
      firstName,
      lastName,
      phone,
      email,
      date,
      time,
      covers,
    },
  }
}
