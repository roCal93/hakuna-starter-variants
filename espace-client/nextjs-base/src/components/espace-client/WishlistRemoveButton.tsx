'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function WishlistRemoveButton({ itemId }: { itemId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleRemove = async () => {
    setLoading(true)
    await fetch(`/api/wishlist/${itemId}`, { method: 'DELETE' })
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={handleRemove}
      disabled={loading}
      aria-label="Retirer des favoris"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 text-stone-400 hover:border-red-200 hover:text-red-500 disabled:opacity-40 transition-colors dark:border-neutral-600 dark:text-neutral-500"
    >
      {loading ? (
        <span className="block h-3 w-3 rounded-full border border-current opacity-50" />
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-3.5 w-3.5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
          />
        </svg>
      )}
    </button>
  )
}
