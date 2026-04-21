import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/admin-auth'

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN

function strapiHeaders(contentType = false) {
  const h: Record<string, string> = { Authorization: `Bearer ${STRAPI_TOKEN}` }
  if (contentType) h['Content-Type'] = 'application/json'
  return h
}

function requireAdmin(request: NextRequest): string | null {
  const token = request.cookies.get(COOKIE_NAME)?.value
  return verifyToken(token)
}

// ─── GET /api/admin/menu-buttons ─────────────────────────────────────────────
// Returns all buttons that have a PDF file, across all sections (fr locale)
export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  }

  const url =
    `${STRAPI_URL}/api/sections` +
    `?pagination[pageSize]=100` +
    `&populate[blocks][on][blocks.button-block][populate][buttons][populate]=file`

  const res = await fetch(url, {
    headers: strapiHeaders(),
    cache: 'no-store',
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Erreur Strapi.' }, { status: 500 })
  }

  const data = await res.json()
  const sections: unknown[] = data?.data ?? []

  // Collect buttons with PDF files
  const result: {
    sectionDocumentId: string
    sectionTitle: string
    blockId: number
    buttonId: number
    buttonLabel: string
    file: { id: number; name: string; url: string } | null
  }[] = []

  for (const section of sections as Record<string, unknown>[]) {
    // Only process the "menu" section
    if (section.identifier !== 'menu') continue

    const blocks = (section.blocks as Record<string, unknown>[]) ?? []
    for (const block of blocks) {
      if (block.__component !== 'blocks.button-block') continue
      const buttons = (block.buttons as Record<string, unknown>[]) ?? []
      for (const button of buttons) {
        const file = button.file as Record<string, unknown> | null
        // Include all buttons from the menu section, with or without PDF
        result.push({
          sectionDocumentId: section.documentId as string,
          sectionTitle: (section.title as string) ?? '',
          blockId: block.id as number,
          buttonId: button.id as number,
          buttonLabel: (button.label as string) ?? '',
          file: file
            ? {
                id: file.id as number,
                name: file.name as string,
                url: file.url as string,
              }
            : null,
        })
      }
    }
  }

  return NextResponse.json(result)
}

// ─── PUT /api/admin/menu-buttons ─────────────────────────────────────────────
// Body: { sectionDocumentId: string, blockId: number, buttonId: number, fileId: number }
// Updates the button's file reference in Strapi
export async function PUT(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  }

  const { sectionDocumentId, blockId, buttonId, fileId } = await request.json()

  if (!sectionDocumentId || !blockId || !buttonId || !fileId) {
    return NextResponse.json(
      { error: 'Paramètres manquants.' },
      { status: 400 }
    )
  }

  // 1. Fetch the full section with all blocks populated so we can rebuild it
  const fetchUrl =
    `${STRAPI_URL}/api/sections/${sectionDocumentId}` +
    `?populate[blocks][on][blocks.button-block][populate][buttons][populate]=file`

  const sectionRes = await fetch(fetchUrl, {
    headers: strapiHeaders(),
    cache: 'no-store',
  })

  if (!sectionRes.ok) {
    return NextResponse.json({ error: 'Section introuvable.' }, { status: 404 })
  }

  const sectionData = await sectionRes.json()
  const section = sectionData?.data as Record<string, unknown>
  if (!section) {
    return NextResponse.json({ error: 'Section introuvable.' }, { status: 404 })
  }

  const blocks = (section.blocks as Record<string, unknown>[]) ?? []

  // 2. Rebuild blocks with the updated button's file
  // Strapi PUT expects: component id + __component + fields, with file as numeric ID
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rebuiltBlocks = blocks.map((block: any) => {
    // For non-button blocks, pass through with minimal fields
    if (block.__component !== 'blocks.button-block' || block.id !== blockId) {
      return rebuildBlock(block)
    }

    // This is the target button block
    return {
      __component: 'blocks.button-block',
      alignment: block.alignment,
      layout: block.layout,
      equalWidth: block.equalWidth,
      buttons: (block.buttons as Record<string, unknown>[]).map(
        (btn: Record<string, unknown>) => {
          if (btn.id !== buttonId) {
            return rebuildButton(btn)
          }
          // Replace this button's file
          return {
            label: btn.label,
            url: btn.url ?? null,
            variant: btn.variant,
            isExternal: btn.isExternal ?? false,
            icon: btn.icon ?? null,
            file: fileId,
          }
        }
      ),
    }
  })

  // 3. PUT the section with updated blocks
  const putRes = await fetch(
    `${STRAPI_URL}/api/sections/${sectionDocumentId}`,
    {
      method: 'PUT',
      headers: strapiHeaders(true),
      body: JSON.stringify({ data: { blocks: rebuiltBlocks } }),
    }
  )

  if (!putRes.ok) {
    const err = await putRes.text()
    console.error('Strapi PUT error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour Strapi.' },
      { status: putRes.status }
    )
  }

  const updated = await putRes.json()
  return NextResponse.json(updated)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rebuildBlock(block: any): Record<string, unknown> {
  // Strapi v5 dynamic zone PUT: do NOT include id
  const { __component, ...rest } = block
  const cleaned: Record<string, unknown> = { __component }
  for (const [key, val] of Object.entries(rest)) {
    if (key === 'id') continue
    if (key === 'buttons') {
      cleaned[key] = (val as Record<string, unknown>[]).map(rebuildButton)
    } else if (
      val &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      'id' in (val as object) &&
      'url' in (val as object)
    ) {
      // It's a media object — convert to ID
      cleaned[key] = (val as Record<string, unknown>).id
    } else {
      cleaned[key] = val
    }
  }
  return cleaned
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rebuildButton(btn: any): Record<string, unknown> {
  // Strapi v5: do NOT include id
  return {
    label: btn.label,
    url: btn.url ?? null,
    variant: btn.variant,
    isExternal: btn.isExternal ?? false,
    icon: btn.icon ?? null,
    file: btn.file ? (btn.file.id ?? btn.file) : null,
  }
}
