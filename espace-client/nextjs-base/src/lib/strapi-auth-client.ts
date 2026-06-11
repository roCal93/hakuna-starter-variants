/**
 * Strapi client authenticated with the current user's JWT (server-side only).
 * The Strapi JWT is stored in a dedicated httpOnly cookie.
 * It is NEVER exposed to the browser.
 */

import { getStrapiSessionJwt } from '@/lib/strapi-session-cookie'

type FetchOptions = {
  method?: string
  body?: unknown
  next?: { revalidate?: number }
}

async function getStrapiJwt(): Promise<string | null> {
  return getStrapiSessionJwt()
}

async function parseStrapiResponse<T>(res: Response) {
  const text = await res.text()
  let parsed: T | null = null
  try {
    parsed = JSON.parse(text) as T
  } catch {
    // non-JSON response (e.g. 204 No Content)
  }

  if (!res.ok) {
    const errObj = (parsed as Record<string, unknown> | null)?.error
    const errMsg =
      typeof errObj === 'string'
        ? errObj
        : errObj != null && typeof errObj === 'object'
          ? ((errObj as Record<string, unknown>).message?.toString() ??
            JSON.stringify(errObj))
          : `Erreur Strapi ${res.status}`
    return { data: null, error: errMsg, status: res.status }
  }

  return { data: parsed, error: null, status: res.status }
}

export async function strapiAuthFetch<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<{ data: T | null; error: string | null; status: number }> {
  const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL
  if (!strapiUrl) throw new Error('NEXT_PUBLIC_STRAPI_URL manquante')

  const jwt = await getStrapiJwt()
  if (!jwt) return { data: null, error: 'Non authentifié', status: 401 }

  const { method = 'GET', body, next } = options

  let res: Response

  try {
    res = await fetch(`${strapiUrl}/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(next ? { next } : {}),
    })
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Échec de connexion à Strapi'

    return {
      data: null,
      error: `Erreur réseau Strapi: ${message}`,
      status: 503,
    }
  }

  return parseStrapiResponse<T>(res)
}

export async function strapiPublicGet<T = unknown>(
  path: string,
  revalidate?: number
): Promise<{ data: T | null; error: string | null; status: number }> {
  const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL
  if (!strapiUrl) throw new Error('NEXT_PUBLIC_STRAPI_URL manquante')

  let res: Response

  try {
    res = await fetch(`${strapiUrl}/api${path}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...(revalidate !== undefined ? { next: { revalidate } } : {}),
    })
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Échec de connexion à Strapi'

    return {
      data: null,
      error: `Erreur réseau Strapi: ${message}`,
      status: 503,
    }
  }

  return parseStrapiResponse<T>(res)
}

/** Convenience: GET */
export async function strapiAuthGet<T = unknown>(
  path: string,
  revalidate?: number
) {
  return strapiAuthFetch<T>(path, {
    next: revalidate !== undefined ? { revalidate } : undefined,
  })
}

/** Convenience: POST */
export async function strapiAuthPost<T = unknown>(path: string, data: unknown) {
  return strapiAuthFetch<T>(path, { method: 'POST', body: { data } })
}

/** Convenience: PATCH */
export async function strapiAuthPatch<T = unknown>(
  path: string,
  data: unknown
) {
  return strapiAuthFetch<T>(path, { method: 'PUT', body: { data } })
}

/** Convenience: DELETE */
export async function strapiAuthDelete<T = unknown>(path: string) {
  return strapiAuthFetch<T>(path, { method: 'DELETE' })
}

/**
 * Strapi service client authenticated with the server-side API token.
 * Bypasses per-user filtering — use only in admin server components.
 */
export async function strapiServiceGet<T = unknown>(
  path: string,
  revalidate?: number
): Promise<{ data: T | null; error: string | null; status: number }> {
  const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL
  if (!strapiUrl) throw new Error('NEXT_PUBLIC_STRAPI_URL manquante')

  const token = process.env.STRAPI_API_TOKEN
  if (!token)
    return { data: null, error: 'STRAPI_API_TOKEN manquant', status: 500 }

  let res: Response

  try {
    res = await fetch(`${strapiUrl}/api${path}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      ...(revalidate !== undefined ? { next: { revalidate } } : {}),
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Échec de connexion à Strapi'
    return {
      data: null,
      error: `Erreur réseau Strapi: ${message}`,
      status: 503,
    }
  }

  return parseStrapiResponse<T>(res)
}
