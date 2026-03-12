import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/admin-auth'
import { enforceSameOrigin } from '@/lib/csrf'

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN

const VALID_DAY_LABELS = new Set([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
])

type OpeningDayPayload = {
  dayLabel: string
  isClosedAllDay: boolean
  firstPeriodOpenTime: string | null
  firstPeriodCloseTime: string | null
  secondPeriodOpenTime: string | null
  secondPeriodCloseTime: string | null
}

type MaybeOpeningDayPayload = OpeningDayPayload | null

type JsonLike =
  | null
  | boolean
  | number
  | string
  | JsonLike[]
  | { [key: string]: JsonLike | undefined }

function normalizeTime(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (!value) return null

  const hhmm = value.match(/^(\d{1,2}):(\d{2})$/)
  if (hhmm) {
    const hour = Number(hhmm[1])
    const minute = Number(hhmm[2])
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    }
    return null
  }

  const hhmmss = value.match(/^(\d{1,2}):(\d{2}):(\d{2})$/)
  if (hhmmss) {
    const hour = Number(hhmmss[1])
    const minute = Number(hhmmss[2])
    const second = Number(hhmmss[3])
    if (
      hour >= 0 &&
      hour <= 23 &&
      minute >= 0 &&
      minute <= 59 &&
      second >= 0 &&
      second <= 59
    ) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    }
  }

  return null
}

function sanitizeOpeningDays(input: unknown): OpeningDayPayload[] {
  if (!Array.isArray(input)) return []

  const mapped: MaybeOpeningDayPayload[] = input.map((raw) => {
    const dayLabel = String(
      (raw as { dayLabel?: unknown })?.dayLabel ?? ''
    ).toLowerCase()
    if (!VALID_DAY_LABELS.has(dayLabel)) return null

    const isClosedAllDay = !!(raw as { isClosedAllDay?: unknown })
      .isClosedAllDay

    const firstPeriodOpenTime =
      (raw as { firstPeriodOpenTime?: unknown }).firstPeriodOpenTime ?? null
    const firstPeriodCloseTime =
      (raw as { firstPeriodCloseTime?: unknown }).firstPeriodCloseTime ?? null
    const secondPeriodOpenTime =
      (raw as { secondPeriodOpenTime?: unknown }).secondPeriodOpenTime ?? null
    const secondPeriodCloseTime =
      (raw as { secondPeriodCloseTime?: unknown }).secondPeriodCloseTime ?? null

    return {
      dayLabel,
      isClosedAllDay,
      firstPeriodOpenTime: normalizeTime(firstPeriodOpenTime),
      firstPeriodCloseTime: normalizeTime(firstPeriodCloseTime),
      secondPeriodOpenTime: normalizeTime(secondPeriodOpenTime),
      secondPeriodCloseTime: normalizeTime(secondPeriodCloseTime),
    }
  })

  return mapped.filter((entry): entry is OpeningDayPayload => entry !== null)
}

function mergeOpeningDays(
  primary: OpeningDayPayload[],
  fallback: OpeningDayPayload[]
): OpeningDayPayload[] {
  const fallbackByDay = new Map(fallback.map((d) => [d.dayLabel, d]))

  return primary.map((day) => {
    const fromFallback = fallbackByDay.get(day.dayLabel)
    if (!fromFallback) return day

    return {
      dayLabel: day.dayLabel,
      isClosedAllDay: day.isClosedAllDay,
      firstPeriodOpenTime:
        day.firstPeriodOpenTime ?? fromFallback.firstPeriodOpenTime,
      firstPeriodCloseTime:
        day.firstPeriodCloseTime ?? fromFallback.firstPeriodCloseTime,
      secondPeriodOpenTime:
        day.secondPeriodOpenTime ?? fromFallback.secondPeriodOpenTime,
      secondPeriodCloseTime:
        day.secondPeriodCloseTime ?? fromFallback.secondPeriodCloseTime,
    }
  })
}

function strapiHeaders() {
  return {
    Authorization: `Bearer ${STRAPI_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

const STRAPI_META_KEYS = new Set([
  'id',
  'documentId',
  'createdAt',
  'updatedAt',
  'publishedAt',
  'locale',
  'localizations',
])

const STRAPI_MEDIA_HINT_KEYS = new Set([
  'url',
  'mime',
  'formats',
  'provider',
  'provider_metadata',
  'alternativeText',
  'previewUrl',
])

function toWritableStrapiValue(value: unknown): JsonLike | undefined {
  if (value === null) return null

  const primitiveType = typeof value
  if (
    primitiveType === 'string' ||
    primitiveType === 'number' ||
    primitiveType === 'boolean'
  ) {
    return value as string | number | boolean
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => toWritableStrapiValue(entry))
      .filter((entry) => entry !== undefined) as JsonLike[]
  }

  if (primitiveType !== 'object' || !value) return undefined

  const record = value as Record<string, unknown>
  const keys = Object.keys(record)

  if (
    typeof record.id === 'number' &&
    keys.some((key) => STRAPI_MEDIA_HINT_KEYS.has(key))
  ) {
    return record.id
  }

  const out: Record<string, JsonLike | undefined> = {}
  for (const [key, entryValue] of Object.entries(record)) {
    if (STRAPI_META_KEYS.has(key)) continue

    const writable = toWritableStrapiValue(entryValue)
    if (writable !== undefined) out[key] = writable
  }

  return out
}

function isTextMapBlock(
  block: unknown
): block is Record<string, unknown> & { __component: 'blocks.text-map-block' } {
  return (
    typeof block === 'object' &&
    block !== null &&
    (block as { __component?: unknown }).__component === 'blocks.text-map-block'
  )
}

function requireAdmin(request: NextRequest): string | null {
  const token = request.cookies.get(COOKIE_NAME)?.value
  return verifyToken(token)
}

async function getPeriodLabelsFromTextMap(): Promise<{
  firstPeriodLabel: string
  secondPeriodLabel: string
}> {
  const fallback = {
    firstPeriodLabel: 'Service 1',
    secondPeriodLabel: 'Service 2',
  }

  try {
    const pagesRes = await fetch(
      `${STRAPI_URL}/api/pages?filters[slug][$eq]=home&locale=fr&pagination[pageSize]=1&populate[sections][populate][blocks][populate]=*`,
      {
        headers: strapiHeaders(),
        cache: 'no-store',
      }
    )

    if (!pagesRes.ok) return fallback
    const pagesData = await pagesRes.json()
    const page = pagesData?.data?.[0]
    if (!page) return fallback

    for (const section of page.sections || []) {
      for (const block of section.blocks || []) {
        if (block.__component !== 'blocks.text-map-block') continue

        const first =
          block.openingHoursFirstPeriodLabel ||
          block.openingHoursLunchLabel ||
          fallback.firstPeriodLabel
        const second =
          block.openingHoursSecondPeriodLabel ||
          block.openingHoursDinnerLabel ||
          fallback.secondPeriodLabel

        return {
          firstPeriodLabel: String(first),
          secondPeriodLabel: String(second),
        }
      }
    }
  } catch {
    return fallback
  }

  return fallback
}

async function getOpeningDaysFromTextMap(): Promise<OpeningDayPayload[]> {
  try {
    const pagesRes = await fetch(
      `${STRAPI_URL}/api/pages?filters[slug][$eq]=home&locale=fr&pagination[pageSize]=1&populate[sections][populate][blocks][populate]=*`,
      {
        headers: strapiHeaders(),
        cache: 'no-store',
      }
    )

    if (!pagesRes.ok) return []
    const pagesData = await pagesRes.json()
    const page = pagesData?.data?.[0]
    if (!page) return []

    for (const section of page.sections || []) {
      for (const block of section.blocks || []) {
        if (block.__component !== 'blocks.text-map-block') continue
        return sanitizeOpeningDays(block.openingDays)
      }
    }
  } catch {
    return []
  }

  return []
}

async function syncTextMapOpeningDays(openingDays: OpeningDayPayload[]) {
  const pagesRes = await fetch(
    `${STRAPI_URL}/api/pages?filters[slug][$eq]=home&locale=fr&pagination[pageSize]=1&populate[sections][populate][blocks][populate]=*`,
    {
      headers: strapiHeaders(),
      cache: 'no-store',
    }
  )

  if (!pagesRes.ok) {
    throw new Error('Impossible de charger la page home Strapi.')
  }

  const pagesData = await pagesRes.json()
  const page = pagesData?.data?.[0]
  if (!Array.isArray(page?.sections)) {
    throw new Error('Page home introuvable pour synchroniser le TextMapBlock.')
  }

  let targetSectionDocumentId: string | null = null
  let writableBlocks: JsonLike | undefined

  for (const section of page.sections) {
    const blocks = Array.isArray(section?.blocks) ? section.blocks : []
    const hasTextMapBlock = blocks.some((block: unknown) => isTextMapBlock(block))
    if (!hasTextMapBlock) continue

    targetSectionDocumentId =
      typeof section?.documentId === 'string' ? section.documentId : null
    if (!targetSectionDocumentId) {
      throw new Error('DocumentId de section introuvable pour TextMapBlock.')
    }

    const nextBlocks = blocks.map((block: unknown) =>
      isTextMapBlock(block)
        ? {
            ...block,
            openingDays,
          }
        : block
    )

    writableBlocks = toWritableStrapiValue(nextBlocks)
    break
  }

  if (!targetSectionDocumentId || !writableBlocks) {
    throw new Error('Aucun TextMapBlock trouve sur la page home.')
  }

  const updateRes = await fetch(
    `${STRAPI_URL}/api/sections/${targetSectionDocumentId}`,
    {
      method: 'PUT',
      headers: strapiHeaders(),
      body: JSON.stringify({ data: { blocks: writableBlocks } }),
    }
  )

  if (!updateRes.ok) {
    const updateBody = await updateRes.text().catch(() => '')
    throw new Error(
      `Echec synchronisation TextMapBlock (${updateRes.status}): ${updateBody}`
    )
  }
}

// GET /api/admin/config
export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  }

  const res = await fetch(
    `${STRAPI_URL}/api/reservation-config?populate=openingDays`,
    {
      headers: strapiHeaders(),
      cache: 'no-store',
    }
  )

  const [periodLabels, textMapOpeningDays] = await Promise.all([
    getPeriodLabelsFromTextMap(),
    getOpeningDaysFromTextMap(),
  ])

  if (res.status === 404) {
    // Default if not yet created
    return NextResponse.json({
      data: { maxCoversPerSlot: 20, openingDays: textMapOpeningDays },
      periodLabels,
    })
  }

  const data = await res.json()
  const configOpeningDays = sanitizeOpeningDays(data?.data?.openingDays)
  const mergedOpeningDays =
    configOpeningDays.length > 0
      ? mergeOpeningDays(configOpeningDays, textMapOpeningDays)
      : textMapOpeningDays

  return NextResponse.json({
    ...data,
    data: {
      ...(data?.data || {}),
      openingDays: mergedOpeningDays,
    },
    periodLabels,
  })
}

// PUT /api/admin/config  { maxCoversPerSlot: number, openingDays?: OpeningDay[] }
export async function PUT(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  }

  const csrfError = enforceSameOrigin(request)
  if (csrfError) return csrfError

  const body = await request.json()
  const maxCoversPerSlot = Number(body?.maxCoversPerSlot)
  const openingDays = sanitizeOpeningDays(body?.openingDays)

  if (!Number.isInteger(maxCoversPerSlot) || maxCoversPerSlot < 1) {
    return NextResponse.json({ error: 'Valeur invalide.' }, { status: 400 })
  }

  try {
    await syncTextMapOpeningDays(openingDays)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erreur synchronisation TextMapBlock.',
      },
      { status: 502 }
    )
  }

  const res = await fetch(`${STRAPI_URL}/api/reservation-config`, {
    method: 'PUT',
    headers: strapiHeaders(),
    body: JSON.stringify({ data: { maxCoversPerSlot, openingDays } }),
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
