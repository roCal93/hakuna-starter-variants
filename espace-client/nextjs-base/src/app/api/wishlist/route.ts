import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getStrapiSessionJwt } from '@/lib/strapi-session-cookie'

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL

async function getStrapiJwt(): Promise<string | null> {
  const session = await auth()
  if (!session) return null
  return getStrapiSessionJwt()
}

/** GET /api/wishlist — list all wishlist items for the current user */
export async function GET() {
  const jwt = await getStrapiJwt()
  if (!jwt)
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const res = await fetch(
    `${STRAPI_URL}/api/wishlist-items?populate[product][populate]=images`,
    { headers: { Authorization: `Bearer ${jwt}` }, cache: 'no-store' }
  )

  const json = await res.json()
  return NextResponse.json(json, { status: res.ok ? 200 : res.status })
}

/** POST /api/wishlist — add a product to wishlist */
export async function POST(req: NextRequest) {
  const jwt = await getStrapiJwt()
  if (!jwt)
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as {
    product?: string
  } | null
  if (!body?.product) {
    return NextResponse.json({ error: 'product requis' }, { status: 400 })
  }

  const res = await fetch(`${STRAPI_URL}/api/wishlist-items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ data: { product: body.product } }),
  })

  const json = await res.json()
  return NextResponse.json(json, { status: res.ok ? 201 : res.status })
}
