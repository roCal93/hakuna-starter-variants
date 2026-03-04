import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/admin-auth'

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN

function requireAdmin(request: NextRequest): string | null {
  const token = request.cookies.get(COOKIE_NAME)?.value
  return verifyToken(token)
}

// GET /api/admin/menu — list PDF files from Strapi media
export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  }

  const res = await fetch(
    `${STRAPI_URL}/api/upload/files?filters[mime][$eq]=application/pdf&sort=createdAt:desc&pagination[pageSize]=50`,
    {
      headers: { Authorization: `Bearer ${STRAPI_TOKEN}` },
      cache: 'no-store',
    }
  )
  const data = await res.json()
  return NextResponse.json(data)
}

// POST /api/admin/menu — upload a PDF to Strapi media library
export async function POST(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'Fichier manquant.' }, { status: 400 })
  }

  if (file.type !== 'application/pdf') {
    return NextResponse.json(
      { error: 'Seuls les fichiers PDF sont acceptés.' },
      { status: 400 }
    )
  }

  const uploadForm = new FormData()
  uploadForm.append('files', file)

  const res = await fetch(`${STRAPI_URL}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${STRAPI_TOKEN}` },
    body: uploadForm,
  })

  if (!res.ok) {
    return NextResponse.json(
      { error: 'Erreur upload Strapi.' },
      { status: res.status }
    )
  }

  const data = await res.json()
  return NextResponse.json(data, { status: 201 })
}

// DELETE /api/admin/menu?id=123
export async function DELETE(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'ID manquant.' }, { status: 400 })
  }

  const res = await fetch(`${STRAPI_URL}/api/upload/files/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${STRAPI_TOKEN}` },
  })

  if (!res.ok) {
    return NextResponse.json(
      { error: 'Erreur Strapi.' },
      { status: res.status }
    )
  }

  return NextResponse.json({ ok: true })
}
