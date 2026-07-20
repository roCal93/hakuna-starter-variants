import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIpFromHeaders } from '@/lib/rate-limit'

const STRAPI_URL = process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL
const STRAPI_WRITE_API_TOKEN =
  process.env.STRAPI_WRITE_API_TOKEN || process.env.STRAPI_API_TOKEN

type UploadResponseItem = {
  id: number
  documentId?: string
  url: string
}

type ExternalMediaItem = {
  url: string
  mime: string
  width?: number
  height?: number
  title?: string
}

function slugifyTitle(input: string) {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function buildPhotoTitle(file: File, index: number) {
  const rawName = file.name.replace(/\.[^.]+$/, '').trim()
  if (rawName.length > 0) return rawName.slice(0, 120)
  return `photo-${index + 1}`
}

function isAllowedMimeType(mimeType: string) {
  return [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/quicktime',
    'video/webm',
  ].includes(mimeType)
}

function getMaxFileSize(file: File) {
  // Vercel body limits can reject large video uploads before processing.
  // Keep a conservative server-side cap to return a clear error message.
  return file.type.startsWith('video/') ? 4 * 1024 * 1024 : 30 * 1024 * 1024
}

function readString(
  formData: FormData,
  key: string,
  options?: { required?: boolean; maxLength?: number }
) {
  const value = formData.get(key)
  if (typeof value !== 'string') {
    if (options?.required) {
      throw new Error(`Champ manquant: ${key}`)
    }
    return ''
  }

  const normalized = value.trim()

  if (options?.required && normalized.length === 0) {
    throw new Error(`Champ vide: ${key}`)
  }

  if (options?.maxLength && normalized.length > options.maxLength) {
    throw new Error(`Champ trop long: ${key}`)
  }

  return normalized
}

async function deleteUploadedMedia(fileId: number) {
  if (!STRAPI_URL || !STRAPI_WRITE_API_TOKEN) return

  await fetch(`${STRAPI_URL}/api/upload/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${STRAPI_WRITE_API_TOKEN}`,
    },
  }).catch(() => undefined)
}

async function tryCreatePhoto(
  paths: Array<string>,
  payload: Record<string, unknown>
) {
  if (!STRAPI_URL || !STRAPI_WRITE_API_TOKEN) {
    throw new Error("Configuration Strapi manquante pour l'upload photo.")
  }

  let lastError: { status: number; body: string } | null = null

  for (const path of paths) {
    const response = await fetch(`${STRAPI_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${STRAPI_WRITE_API_TOKEN}`,
      },
      body: JSON.stringify({ data: payload }),
    })

    if (response.ok) {
      return response
    }

    lastError = {
      status: response.status,
      body: await response.text(),
    }
  }

  throw new Error(
    lastError
      ? `Création photo échouée (${lastError.status}): ${lastError.body}`
      : 'Création photo échouée.'
  )
}

export async function POST(request: NextRequest) {
  if (!STRAPI_URL || !STRAPI_WRITE_API_TOKEN) {
    return NextResponse.json(
      { error: "Configuration serveur incomplète pour l'upload photo." },
      { status: 500 }
    )
  }

  const clientIp = getClientIpFromHeaders(request.headers)
  const rateLimit = await checkRateLimit({
    key: `photo-upload:${clientIp}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  })

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessaie dans quelques minutes.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'X-RateLimit-Reset': String(rateLimit.resetAt),
        },
      }
    )
  }

  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const payload = (await request.json().catch(() => null)) as {
      authorName?: string
      externalMedia?: ExternalMediaItem[]
    } | null

    const authorName = payload?.authorName?.trim() || ''
    const externalMedia = Array.isArray(payload?.externalMedia)
      ? payload.externalMedia
      : []

    if (!authorName) {
      return NextResponse.json(
        { error: 'Champ vide: authorName' },
        { status: 400 }
      )
    }

    if (externalMedia.length === 0) {
      return NextResponse.json(
        { error: 'Aucun média externe reçu.' },
        { status: 400 }
      )
    }

    try {
      for (const [index, item] of externalMedia.entries()) {
        if (!item.url || !item.mime) {
          throw new Error('Media externe invalide: url/mime requis.')
        }

        const mediaType = item.mime.startsWith('video/') ? 'video' : 'image'

        const safeTitle =
          (item.title && item.title.trim()) ||
          `${mediaType}-${Date.now()}-${index + 1}`
        const baseSlug = slugifyTitle(safeTitle) || mediaType

        await tryCreatePhoto(['/api/photos?status=published', '/api/photos'], {
          title: safeTitle.slice(0, 120),
          slug: `${baseSlug}-${Date.now()}-${index + 1}`,
          authorName,
          visibility: 'public',
          moderationStatus: 'approved',
          mediaType,
          externalUrl: item.url,
          externalMime: item.mime,
          externalWidth: typeof item.width === 'number' ? item.width : null,
          externalHeight: typeof item.height === 'number' ? item.height : null,
        })
      }

      return NextResponse.json(
        {
          ok: true,
          message: `${externalMedia.length} média(s) publié(s) avec succès.`,
        },
        { status: 201 }
      )
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Erreur lors de la création du média externe.',
        },
        { status: 502 }
      )
    }
  }

  const formData = await request.formData()

  let authorName = ''

  try {
    authorName = readString(formData, 'authorName', {
      required: true,
      maxLength: 80,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Champs obligatoires invalides.',
      },
      { status: 400 }
    )
  }

  const rawFiles = formData.getAll('files')
  const files = rawFiles.filter((entry): entry is File => entry instanceof File)

  if (files.length === 0) {
    return NextResponse.json(
      { error: 'Au moins une photo est requise.' },
      { status: 400 }
    )
  }

  for (const file of files) {
    if (!isAllowedMimeType(file.type)) {
      return NextResponse.json(
        {
          error:
            'Format non supporté. Utilise JPEG, PNG, WebP, HEIC, MP4, MOV ou WebM.',
        },
        { status: 400 }
      )
    }

    if (file.size > getMaxFileSize(file)) {
      return NextResponse.json(
        {
          error: file.type.startsWith('video/')
            ? 'Chaque vidéo doit faire moins de 4 Mo pour cet upload web.'
            : 'Chaque image doit faire moins de 30 Mo.',
        },
        { status: 400 }
      )
    }
  }

  const uploadedFileIds: number[] = []

  try {
    for (const [index, file] of files.entries()) {
      const uploadBody = new FormData()
      uploadBody.append('files', file)

      const uploadResponse = await fetch(`${STRAPI_URL}/api/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${STRAPI_WRITE_API_TOKEN}`,
        },
        body: uploadBody,
      })

      if (!uploadResponse.ok) {
        const upstreamBody = await uploadResponse.text().catch(() => '')
        throw new Error(
          `Upload media impossible (${uploadResponse.status})${upstreamBody ? `: ${upstreamBody}` : ''}`
        )
      }

      const uploadedItems =
        (await uploadResponse.json()) as UploadResponseItem[]
      const uploadedFile = Array.isArray(uploadedItems)
        ? uploadedItems[0]
        : null

      if (!uploadedFile) {
        throw new Error('Aucun média reçu après upload.')
      }

      uploadedFileIds.push(uploadedFile.id)

      const title = buildPhotoTitle(file, index)
      const baseSlug = slugifyTitle(title) || 'photo'
      const photoPayloadBase = {
        title,
        slug: `${baseSlug}-${Date.now()}-${index + 1}`,
        authorName,
        visibility: 'public',
        moderationStatus: 'approved',
        mediaType: 'image',
        image: uploadedFile.id,
      }

      await tryCreatePhoto(
        ['/api/photos?status=published', '/api/photos'],
        photoPayloadBase
      )
    }

    return NextResponse.json(
      {
        ok: true,
        message: `${files.length} média(s) publié(s) avec succès.`,
      },
      { status: 201 }
    )
  } catch (error) {
    // Best-effort cleanup for files uploaded before a later create step failed.
    if (uploadedFileIds.length > 0) {
      await Promise.all(
        uploadedFileIds.map((fileId) => deleteUploadedMedia(fileId))
      )
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erreur lors de la création de la photo.',
      },
      { status: 502 }
    )
  }
}
