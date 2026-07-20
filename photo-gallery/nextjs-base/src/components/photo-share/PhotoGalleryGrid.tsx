'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WeddingRsvpCardBackground } from '@/components/photo-share/WeddingRsvpBackground'

type PaginationMeta = {
  page: number
  pageSize: number
  pageCount: number
  total: number
}

type GalleryPhoto = {
  documentId?: string
  title: string
  slug: string
  authorName: string
  mediaType?: 'image' | 'video'
  externalUrl?: string | null
  externalMime?: string | null
  externalWidth?: number | null
  externalHeight?: number | null
  image?: {
    url?: string | null
    alternativeText?: string | null
    width?: number | null
    height?: number | null
    mime?: string | null
    ext?: string | null
  } | null
}

type PhotoGalleryGridProps = {
  locale: string
  photos: GalleryPhoto[]
  pagination: PaginationMeta
  loadMore: (
    page: number
  ) => Promise<{ data: GalleryPhoto[]; meta: { pagination?: PaginationMeta } }>
}

function isVideo(mime?: string) {
  return typeof mime === 'string' && mime.startsWith('video/')
}

function getMediaMime(photo: GalleryPhoto) {
  if (photo.mediaType === 'video') return photo.externalMime || 'video/mp4'
  return photo.image?.mime || photo.externalMime || undefined
}

function getMediaUrl(photo: GalleryPhoto) {
  if (photo.mediaType === 'video') return photo.externalUrl || ''
  return photo.image?.url || photo.externalUrl || ''
}

function getCardSpanClass(width?: number, height?: number) {
  if (!width || !height) {
    return 'col-span-1'
  }

  return width > height ? 'col-span-2' : 'col-span-1'
}

function getSelectionKey(photo: GalleryPhoto) {
  return photo.documentId || photo.slug
}

function getDownloadName(photo: GalleryPhoto, index: number) {
  const fallbackBaseName =
    photo.title
      .trim()
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/-+/g, '-') || `media-${index + 1}`

  const mediaUrl = getMediaUrl(photo)
  const pathname = (() => {
    try {
      return new URL(mediaUrl).pathname
    } catch {
      return ''
    }
  })()

  const extFromUrl = pathname.split('.').pop()
  const extFromImage = photo.image?.ext?.replace(/^\./, '')
  const extFromMime = getMediaMime(photo)?.split('/').pop()
  const extension = extFromUrl || extFromImage || extFromMime || 'bin'

  return `${fallbackBaseName}.${extension}`
}

function triggerDownload(url: string, fileName: string) {
  // Route through our same-origin proxy so iOS Safari respects the
  // `download` attribute (cross-origin URLs are silently ignored on iOS).
  const proxyUrl = `/api/download?${new URLSearchParams({ url, name: fileName }).toString()}`
  const anchor = document.createElement('a')
  anchor.href = proxyUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

const GALLERY_SESSION_PAGE = 'photo-gallery-page'
const GALLERY_SESSION_SLUG = 'photo-gallery-slug'

export function PhotoGalleryGrid({
  locale,
  photos: initialPhotos,
  pagination: initialPagination,
  loadMore,
}: PhotoGalleryGridProps) {
  const [allPhotos, setAllPhotos] = useState<GalleryPhoto[]>(initialPhotos)
  const [pagination, setPagination] =
    useState<PaginationMeta>(initialPagination)
  const [loadingMore, setLoadingMore] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [downloading, setDownloading] = useState(false)
  const [preparingZip, setPreparingZip] = useState(false)
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null)
  const loadMoreRef = useRef(loadMore)
  // Synchronously initialized: prevents IntersectionObserver from firing during restore
  const isRestoringRef = useRef(
    typeof window !== 'undefined'
      ? Number(sessionStorage.getItem(GALLERY_SESSION_PAGE)) > 1
      : false
  )
  const galleryPageSize = 24

  const hasMore = pagination.page < pagination.pageCount

  // Keep the ref in sync with the latest loadMore without adding it to
  // handleLoadMore's dependency array (avoids observer/effect re-subscriptions).
  useEffect(() => {
    loadMoreRef.current = loadMore
  })

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore || isRestoringRef.current) return
    setLoadingMore(true)
    try {
      const result = await loadMore(pagination.page + 1)
      setAllPhotos((prev) => [...prev, ...result.data])
      if (result.meta.pagination) {
        setPagination(result.meta.pagination)
      }
    } finally {
      setLoadingMore(false)
    }
  }, [hasMore, loadMore, loadingMore, pagination.page])

  // Restore the gallery position when coming back from a photo detail page
  useEffect(() => {
    const savedPage = Number(sessionStorage.getItem(GALLERY_SESSION_PAGE))
    const savedSlug = sessionStorage.getItem(GALLERY_SESSION_SLUG)

    sessionStorage.removeItem(GALLERY_SESSION_PAGE)
    sessionStorage.removeItem(GALLERY_SESSION_SLUG)

    if (!savedSlug) return

    const scrollToPhoto = () => {
      const el = document.getElementById(`photo-${savedSlug}`)
      el?.scrollIntoView({ block: 'center', behavior: 'instant' })
    }

    if (!savedPage || savedPage <= 1) {
      requestAnimationFrame(() => scrollToPhoto())
      return
    }

    async function restorePages() {
      setLoadingMore(true)
      try {
        let page = 1
        while (page < savedPage) {
          const result = await loadMoreRef.current(page + 1)
          setAllPhotos((prev) => [...prev, ...result.data])
          if (result.meta.pagination) {
            setPagination(result.meta.pagination)
          }
          page++
        }
      } finally {
        isRestoringRef.current = false
        setLoadingMore(false)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => scrollToPhoto())
        })
      }
    }

    void restorePages()
  }, [])

  useEffect(() => {
    if (!hasMore) return

    const node = loadMoreTriggerRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0]
        if (!firstEntry?.isIntersecting) return
        void handleLoadMore()
      },
      {
        root: null,
        rootMargin: '320px 0px',
        threshold: 0,
      }
    )

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [hasMore, handleLoadMore])

  const selectedPhotos = useMemo(
    () =>
      allPhotos.filter((photo) =>
        selectedKeys.includes(getSelectionKey(photo))
      ),
    [allPhotos, selectedKeys]
  )

  function toggleSelection(key: string) {
    setSelectedKeys((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    )
  }

  function selectAll() {
    setSelectedKeys(allPhotos.map(getSelectionKey))
  }

  function clearSelection() {
    setSelectedKeys([])
  }

  async function downloadPhotos(photosToDownload: GalleryPhoto[]) {
    if (photosToDownload.length === 0) return
    setDownloading(true)
    try {
      if (photosToDownload.length === 1) {
        // Single file: synchronous same-origin proxy click — works on all mobile browsers
        const photo = photosToDownload[0]!
        const mediaUrl = getMediaUrl(photo)
        if (mediaUrl) triggerDownload(mediaUrl, getDownloadName(photo, 0))
        return
      }

      // Multiple files: generate a ZIP server-side and trigger a single download
      setPreparingZip(true)
      const files = photosToDownload
        .map((photo, index) => ({
          url: getMediaUrl(photo),
          name: getDownloadName(photo, index),
        }))
        .filter((f) => Boolean(f.url))

      const response = await fetch('/api/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      })

      if (!response.ok) throw new Error('ZIP failed')

      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = blobUrl
      anchor.download = 'photos.zip'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(blobUrl)
    } finally {
      setDownloading(false)
      setPreparingZip(false)
    }
  }

  async function downloadSelection() {
    await downloadPhotos(selectedPhotos)
  }

  async function downloadAll() {
    await downloadPhotos(allPhotos)
  }

  return (
    <>
      <div className="relative mb-6 flex flex-wrap items-center gap-3 overflow-hidden rounded-[2rem] border border-stone-200 bg-white p-4 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.25)]">
        <WeddingRsvpCardBackground />
        <div className="relative z-10 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-stone-700">
            {selectedKeys.length} fichier(s) sélectionné(s) sur{' '}
            {allPhotos.length}
            {hasMore ? ` (${pagination.total} au total)` : ''}
          </span>
          <button
            type="button"
            onClick={selectAll}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-950"
          >
            Tout sélectionner
          </button>
          <button
            type="button"
            onClick={clearSelection}
            disabled={selectedKeys.length === 0}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Effacer
          </button>
          <button
            type="button"
            onClick={downloadAll}
            disabled={allPhotos.length === 0 || downloading}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {preparingZip
              ? 'En préparation...'
              : `Télécharger tout (${allPhotos.length})`}
          </button>
          <button
            type="button"
            onClick={downloadSelection}
            disabled={selectedKeys.length === 0 || downloading}
            className="rounded-full bg-stone-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {preparingZip
              ? 'En préparation...'
              : `Télécharger la sélection${selectedKeys.length > 0 ? ` (${selectedKeys.length})` : ''}`}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {allPhotos.map((photo) => {
          const key = getSelectionKey(photo)
          const selected = selectedKeys.includes(key)

          return (
            <div
              key={key}
              id={`photo-${photo.slug}`}
              className={getCardSpanClass(
                photo.mediaType === 'video'
                  ? (photo.externalWidth ?? undefined)
                  : (photo.image?.width ?? undefined),
                photo.mediaType === 'video'
                  ? (photo.externalHeight ?? undefined)
                  : (photo.image?.height ?? undefined)
              )}
            >
              <div className="relative">
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleSelection(key)}
                  className={`absolute left-4 top-4 z-20 inline-flex h-10 min-w-10 items-center justify-center rounded-full border px-3 text-sm font-semibold backdrop-blur transition ${
                    selected
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-white/60 bg-white/85 text-stone-800 hover:bg-white'
                  }`}
                >
                  {selected ? '✓' : '+'}
                </button>

                <Link
                  href={`/${locale}/photos/${photo.slug}`}
                  onClick={() => {
                    const idx = allPhotos.findIndex(
                      (p) => getSelectionKey(p) === key
                    )
                    const page =
                      idx >= 0
                        ? Math.ceil((idx + 1) / galleryPageSize)
                        : pagination.page
                    sessionStorage.setItem(GALLERY_SESSION_PAGE, String(page))
                    sessionStorage.setItem(GALLERY_SESSION_SLUG, photo.slug)
                  }}
                  className="group block overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] transition hover:-translate-y-1 hover:shadow-[0_32px_90px_-44px_rgba(15,23,42,0.5)]"
                >
                  <div className="relative h-80 bg-stone-100 md:h-[26rem] xl:h-[30rem]">
                    {isVideo(getMediaMime(photo)) ? (
                      <>
                        <video
                          src={getMediaUrl(photo)}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                          muted
                          playsInline
                          preload="metadata"
                        />
                        <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-black/40 text-2xl text-white backdrop-blur-sm">
                            ▶
                          </span>
                        </span>
                      </>
                    ) : (
                      <Image
                        src={getMediaUrl(photo)}
                        alt={photo.image?.alternativeText || photo.title}
                        fill
                        className="object-cover transition duration-500 group-hover:scale-[1.03]"
                        style={{ ['imageOrientation' as never]: 'from-image' }}
                        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                      />
                    )}
                  </div>
                </Link>
              </div>

              <div className="px-1 pt-3">
                <p className="text-sm italic text-stone-500">
                  {photo.authorName}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {hasMore && (
        <div className="mt-10">
          <div ref={loadMoreTriggerRef} className="h-1 w-full" />
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="rounded-full border border-stone-300 px-8 py-3 text-sm font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingMore
                ? 'Chargement...'
                : `Charger plus (${pagination.total - allPhotos.length} restant${pagination.total - allPhotos.length > 1 ? 's' : ''})`}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
