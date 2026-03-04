import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/admin-auth'
import { enforceSameOrigin } from '@/lib/csrf'

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN

function strapiHeaders() {
  return {
    Authorization: `Bearer ${STRAPI_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

function requireAdmin(request: NextRequest): string | null {
  const token = request.cookies.get(COOKIE_NAME)?.value
  return verifyToken(token)
}

// GET /api/admin/config
export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  }

  const res = await fetch(`${STRAPI_URL}/api/reservation-config`, {
    headers: strapiHeaders(),
    cache: 'no-store',
  })

  if (res.status === 404) {
    // Default if not yet created
    return NextResponse.json({ data: { maxCoversPerSlot: 20 } })
  }

  const data = await res.json()
  return NextResponse.json(data)
}

// PUT /api/admin/config  { maxCoversPerSlot: number }
export async function PUT(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  }

  const csrfError = enforceSameOrigin(request)
  if (csrfError) return csrfError

  const body = await request.json()
  const maxCoversPerSlot = Number(body?.maxCoversPerSlot)

  if (!Number.isInteger(maxCoversPerSlot) || maxCoversPerSlot < 1) {
    return NextResponse.json({ error: 'Valeur invalide.' }, { status: 400 })
  }

  const res = await fetch(`${STRAPI_URL}/api/reservation-config`, {
    method: 'PUT',
    headers: strapiHeaders(),
    body: JSON.stringify({ data: { maxCoversPerSlot } }),
  })

  if (!res.ok) {
    return NextResponse.json(
      { error: 'Erreur Strapi.' },
      { status: res.status }
    )
  }

  const data = await res.json()
  return NextResponse.json(data)
}
