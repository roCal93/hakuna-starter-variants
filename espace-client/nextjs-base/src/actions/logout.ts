'use server'

import { cookies } from 'next/headers'
import { STRAPI_SESSION_COOKIE } from '@/lib/strapi-session-cookie'

// All possible Auth.js v5 cookie names (HTTP dev + HTTPS prod variants)
const AUTH_COOKIE_NAMES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
  'authjs.callback-url',
  '__Secure-authjs.callback-url',
  'authjs.csrf-token',
  '__Host-authjs.csrf-token',
]

/**
 * Clears all auth session cookies server-side.
 * Does NOT redirect — the caller handles navigation.
 * Using redirect() from a Server Action causes a 400 in Next.js
 * because redirect() throws NEXT_REDIRECT which React's action runtime mishandles.
 */
export async function logoutAction() {
  const cookieStore = await cookies()
  for (const name of AUTH_COOKIE_NAMES) {
    cookieStore.delete(name)
  }
  cookieStore.delete(STRAPI_SESSION_COOKIE)
}
