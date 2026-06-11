'use client'

import { useEffect, useState, useTransition } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'

interface WishlistButtonProps {
  productDocumentId: string
  className?: string
}

type WishlistItem = { documentId: string }

export function WishlistButton({
  productDocumentId,
  className = '',
}: WishlistButtonProps) {
  const { status } = useSession()
  const pathname = usePathname()
  const locale = pathname.split('/')[1] === 'en' ? 'en' : 'fr'

  const [isFavorite, setIsFavorite] = useState(false)
  const [wishlistItemId, setWishlistItemId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (status !== 'authenticated') return

    fetch('/api/wishlist')
      .then((r) => r.json())
      .then((json: { data: WishlistItem[] }) => {
        const items = json?.data ?? []
        // The server returns items with product.documentId populated
        const matched = items.find(
          (i: WishlistItem & { product?: { documentId?: string } }) =>
            (i as { product?: { documentId?: string } }).product?.documentId ===
            productDocumentId
        ) as (WishlistItem & { product?: { documentId?: string } }) | undefined
        if (matched) {
          setIsFavorite(true)
          setWishlistItemId(matched.documentId)
        }
      })
      .catch(() => {})
  }, [status, productDocumentId])

  const toggle = () => {
    if (status !== 'authenticated') {
      window.location.href = `/${locale}/espace-client/connexion?from=${encodeURIComponent(pathname)}`
      return
    }

    startTransition(async () => {
      if (isFavorite && wishlistItemId) {
        await fetch(`/api/wishlist/${wishlistItemId}`, { method: 'DELETE' })
        setIsFavorite(false)
        setWishlistItemId(null)
      } else {
        const res = await fetch('/api/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product: productDocumentId }),
        })
        const json = (await res.json()) as { data?: WishlistItem }
        if (json?.data?.documentId) {
          setIsFavorite(true)
          setWishlistItemId(json.data.documentId)
        }
      }
    })
  }

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      className={[
        'flex items-center justify-center transition-opacity disabled:opacity-50',
        isFavorite
          ? 'text-stone-900 dark:text-white'
          : 'text-stone-300 hover:text-stone-700 dark:text-neutral-500 dark:hover:text-neutral-200',
        className,
      ].join(' ')}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={isFavorite ? '#9ca3af' : 'none'}
        stroke={isFavorite ? '#111827' : 'currentColor'}
        strokeWidth={1.5}
        className="h-8 w-8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
        />
      </svg>
    </button>
  )
}
