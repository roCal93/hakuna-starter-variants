import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/admin-auth'
import { enforceSameOrigin } from '@/lib/csrf'
import { isValidBlockedSlotInput } from '@/lib/reservation-validation'

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

// GET /api/admin/blocked-slots
export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  }

  const res = await fetch(
    `${STRAPI_URL}/api/blocked-slots?sort=date:asc,time:asc&pagination[pageSize]=500`,
    { headers: strapiHeaders(), cache: 'no-store' }
  )
  const data = await res.json()
  return NextResponse.json(data)
}

// POST /api/admin/blocked-slots  { date, time?, label? }
export async function POST(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  }

  const csrfError = enforceSameOrigin(request)
  if (csrfError) return csrfError

  const body = await request.json()
  const { date, time, label } = body

  if (!date) {
    return NextResponse.json({ error: 'Date requise.' }, { status: 400 })
  }

  if (!isValidBlockedSlotInput(date, time)) {
    return NextResponse.json(
      { error: 'Date ou créneau invalide.' },
      { status: 400 }
    )
  }

  if (label && String(label).length > 120) {
    return NextResponse.json({ error: 'Note trop longue.' }, { status: 400 })
  }

  const res = await fetch(`${STRAPI_URL}/api/blocked-slots`, {
    method: 'POST',
    headers: strapiHeaders(),
    body: JSON.stringify({
      data: {
        date: String(date),
        time: time ? String(time) : null,
        label: label ? String(label).trim() : null,
      },
    }),
  })

  if (!res.ok) {
    return NextResponse.json(
      { error: 'Erreur Strapi.' },
      { status: res.status }
    )
  }

  const data = await res.json()
  return NextResponse.json(data, { status: 201 })
}
