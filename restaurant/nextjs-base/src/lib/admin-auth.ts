import { createHmac, timingSafeEqual } from 'crypto'

const SECRET = process.env.ADMIN_SECRET
const COOKIE_NAME = 'admin_token'
const TOKEN_TTL = 8 * 60 * 60 * 1000 // 8 heures en ms

/** Signe un payload et retourne un token "payload.signature" en base64url */
export function signToken(username: string): string {
  if (!SECRET) {
    throw new Error('ADMIN_SECRET is not configured')
  }

  const payload = Buffer.from(
    JSON.stringify({ u: username, exp: Date.now() + TOKEN_TTL })
  ).toString('base64url')
  const sig = createHmac('sha256', SECRET).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

/** Vérifie la signature et l'expiry. Retourne le username ou null. */
export function verifyToken(token: string | undefined): string | null {
  if (!SECRET) return null
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payload, sig] = parts
  const expectedSig = createHmac('sha256', SECRET)
    .update(payload)
    .digest('base64url')
  try {
    const sigBuf = Buffer.from(sig, 'ascii')
    const expectedBuf = Buffer.from(expectedSig, 'ascii')
    if (sigBuf.length !== expectedBuf.length) return null
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null
  } catch {
    return null
  }
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (Date.now() > data.exp) return null
    return data.u as string
  } catch {
    return null
  }
}

export { COOKIE_NAME }
