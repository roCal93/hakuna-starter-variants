import { getCurrentStrapiUser } from '@/lib/strapi-session-cookie'
import { redirect } from 'next/navigation'
import { strapiAuthGet } from '@/lib/strapi-auth-client'
import Link from 'next/link'
import Image from 'next/image'
import { cleanImageUrl } from '@/lib/strapi'
import { formatPrice } from '@/lib/currency'
import { WishlistRemoveButton } from '@/components/espace-client/WishlistRemoveButton'

interface Product {
  documentId: string
  name: string
  slug: string
  price: number
  active: boolean
  images?: { url: string; alternativeText?: string }[]
}

interface WishlistItem {
  documentId: string
  product?: Product
}

interface StrapiList<T> {
  data: T[]
}

export default async function FavorisPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const strapiUser = await getCurrentStrapiUser()

  if (!strapiUser) redirect(`/${locale}/espace-client/connexion`)

  const { data } = await strapiAuthGet<StrapiList<WishlistItem>>(
    '/wishlist-items?populate[product][populate]=images',
    0
  )

  const items = data?.data ?? []

  return (
    <div>
      <p className="font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.18em] text-neutral-500">
        Espace client
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[0.01em] text-neutral-900 dark:text-white">
        Mes favoris
      </h1>
      <p className="mt-1 text-sm text-neutral-500 mb-8">
        {items.length} montre{items.length !== 1 ? 's' : ''} sauvegardée
        {items.length !== 1 ? 's' : ''}
      </p>

      {items.length === 0 ? (
        <div className="border border-dashed border-neutral-200 bg-white py-16 px-6 text-center dark:border-neutral-700 dark:bg-neutral-900">
          <p className="text-neutral-500 text-sm dark:text-neutral-400">
            Aucun favori pour le moment.
          </p>
          <Link
            href={`/${locale}/boutique`}
            className="mt-4 inline-block font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.1em] text-neutral-800 transition-colors hover:text-black dark:text-neutral-200 dark:hover:text-white"
          >
            Découvrir la boutique
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const product = item.product
            if (!product) return null
            const imgUrl = cleanImageUrl(product.images?.[0]?.url)

            return (
              <li
                key={item.documentId}
                className="group border border-neutral-200 bg-white shadow-sm overflow-hidden hover:border-neutral-400 hover:shadow-md transition-all dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-500"
              >
                <Link href={`/${locale}/boutique/${product.slug}`}>
                  <div className="relative aspect-square bg-neutral-100 dark:bg-neutral-800">
                    {imgUrl ? (
                      <Image
                        src={imgUrl}
                        alt={
                          product.images?.[0]?.alternativeText ?? product.name
                        }
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 100vw, 280px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-neutral-100" />
                    )}
                    {!product.active && (
                      <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                        <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-neutral-500 shadow dark:text-neutral-300">
                          Épuisé
                        </span>
                      </div>
                    )}
                  </div>
                </Link>

                <div className="p-4">
                  <Link href={`/${locale}/boutique/${product.slug}`}>
                    <p className="text-sm font-semibold text-neutral-900 truncate hover:text-black transition-colors dark:text-white dark:hover:text-neutral-300">
                      {product.name}
                    </p>
                  </Link>
                  <p className="mt-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {formatPrice(product.price)}
                  </p>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <Link
                      href={`/${locale}/boutique/${product.slug}`}
                      className="flex-1 text-center border border-black bg-black px-3 py-2 font-[family-name:var(--font-geist-mono)] text-[10px] font-semibold uppercase tracking-[0.1em] text-white hover:bg-neutral-800 transition-colors dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                    >
                      Voir la montre
                    </Link>
                    <WishlistRemoveButton itemId={item.documentId} />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
