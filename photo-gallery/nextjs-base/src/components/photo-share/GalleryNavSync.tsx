'use client'

import { useEffect } from 'react'

const GALLERY_SESSION_PAGE = 'photo-gallery-page'
const GALLERY_SESSION_SLUG = 'photo-gallery-slug'

type Props = { slug: string; page: number }

/**
 * Updates sessionStorage when the user navigates between photos via the
 * prev/next arrows. Only runs when a gallery context already exists in
 * sessionStorage (i.e. the user originally came from the gallery).
 */
export function GalleryNavSync({ slug, page }: Props) {
  useEffect(() => {
    if (sessionStorage.getItem(GALLERY_SESSION_SLUG) === null) return
    sessionStorage.setItem(GALLERY_SESSION_SLUG, slug)
    sessionStorage.setItem(GALLERY_SESSION_PAGE, String(page))
  }, [slug, page])

  return null
}
