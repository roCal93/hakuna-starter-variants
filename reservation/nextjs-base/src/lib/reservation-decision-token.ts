import { createHmac, timingSafeEqual } from 'crypto'

const SECRET = process.env.RESERVATION_DECISION_SECRET || process.env.ADMIN_SECRET
const TOKEN_TTL = 7 * 24 * 60 * 60 * 1000

type ReservationDecisionStatus = 'confirmed' | 'cancelled'

type DecisionPayload = {
  id: string
  status: ReservationDecisionStatus
  exp: number
}

export function signReservationDecisionToken(
  id: string,
  status: ReservationDecisionStatus
): string | null {
  if (!SECRET) return null

  const payload: DecisionPayload = {
    id,
    status,
    exp: Date.now() + TOKEN_TTL,
  }

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', SECRET)
    .update(encodedPayload)
    .digest('base64url')

  return `${encodedPayload}.${signature}`
}

export function verifyReservationDecisionToken(
  token: string | null
): { id: string; status: ReservationDecisionStatus } | null {
  if (!SECRET || !token) return null

  const parts = token.split('.')
  if (parts.length !== 2) return null

  const [payload, signature] = parts
  const expectedSignature = createHmac('sha256', SECRET)
    .update(payload)
    .digest('base64url')

  try {
    const signatureBuffer = Buffer.from(signature, 'ascii')
    const expectedBuffer = Buffer.from(expectedSignature, 'ascii')
    if (signatureBuffer.length !== expectedBuffer.length) return null
    if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null
  } catch {
    return null
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as DecisionPayload

    if (!parsed?.id || !parsed?.status || !parsed?.exp) return null
    if (!['confirmed', 'cancelled'].includes(parsed.status)) return null
    if (Date.now() > parsed.exp) return null

    return { id: parsed.id, status: parsed.status }
  } catch {
    return null
  }
}
