function getStrapiUrl() {
  const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL
  if (!strapiUrl) throw new Error('NEXT_PUBLIC_STRAPI_URL manquante')

  return strapiUrl
}

export type StrapiUser = {
  id: number
  email: string
  username: string
}

type StrapiAuthResult = {
  jwt: string
  user: StrapiUser
}

export async function getStrapiUserFromJwt(jwt: string) {
  const strapiUrl = getStrapiUrl()

  const res = await fetch(`${strapiUrl}/api/users/me`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    cache: 'no-store',
  })

  if (!res.ok) return null

  return (await res.json()) as StrapiUser
}

export async function authenticateStrapiUser(email: string, password: string) {
  const strapiUrl = getStrapiUrl()

  const res = await fetch(`${strapiUrl}/api/auth/local`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password }),
  })

  if (!res.ok) return null

  return (await res.json()) as StrapiAuthResult
}
