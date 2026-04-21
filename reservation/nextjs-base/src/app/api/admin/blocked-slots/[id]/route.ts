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

// DELETE /api/admin/blocked-slots/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  }

  const csrfError = enforceSameOrigin(request)
  if (csrfError) return csrfError

  const { id } = await params

  const res = await fetch(`${STRAPI_URL}/api/blocked-slots/${id}`, {
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
