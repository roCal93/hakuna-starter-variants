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

// GET /api/admin/reservations?status=pending|confirmed|cancelled
export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  let url = `${STRAPI_URL}/api/reservations?sort=date:asc,time:asc&pagination[pageSize]=200`
  if (status) url += `&filters[status][$eq]=${status}`

  const res = await fetch(url, { headers: strapiHeaders(), cache: 'no-store' })
  const data = await res.json()
  return NextResponse.json(data)
}

// DELETE /api/admin/reservations?id=123
export async function DELETE(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  }

  const csrfError = enforceSameOrigin(request)
  if (csrfError) return csrfError

  const { searchParams } = new URL(request.url)
  const documentId = searchParams.get('id')
  if (!documentId) {
    return NextResponse.json({ error: 'ID manquant.' }, { status: 400 })
  }

  const res = await fetch(`${STRAPI_URL}/api/reservations/${documentId}`, {
    method: 'DELETE',
    headers: strapiHeaders(),
  })
  if (!res.ok) {
    return NextResponse.json(
      { error: 'Erreur Strapi.' },
      { status: res.status }
    )
  }
  return NextResponse.json({ ok: true })
}
