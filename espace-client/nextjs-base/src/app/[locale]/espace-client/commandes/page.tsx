import { redirect } from 'next/navigation'
import { getCurrentStrapiUser } from '@/lib/strapi-session-cookie'
import Link from 'next/link'
import Image from 'next/image'
import { formatPrice } from '@/lib/currency'
import { cleanImageUrl } from '@/lib/strapi'

interface LineItem {
  productName: string
  productSlug: string
  quantity: number
  unitPrice: number
  total: number
}

interface Order {
  documentId: string
  status: string
  createdAt: string
  total: number
  lineItems: LineItem[]
}

interface StrapiList<T> {
  data: T[]
}

interface ProductImage {
  formats?: { small?: { url: string }; thumbnail?: { url: string } }
  url: string
}

interface Product {
  slug: string
  images: ProductImage[]
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  paid: 'Payé',
  shipped: 'Expédié',
  cancelled: 'Annulé',
  refunded: 'Remboursé',
}

const STATUS_COLORS: Record<string, string> = {
  pending:
    'bg-stone-100 text-stone-600 dark:bg-neutral-700 dark:text-neutral-300',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  shipped: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  refunded:
    'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
}

export default async function CommandesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const strapiUser = await getCurrentStrapiUser()
  if (!strapiUser) redirect(`/${locale}/espace-client/connexion`)

  const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL
  const token = process.env.STRAPI_API_TOKEN
  const headers = { Authorization: `Bearer ${token}` }

  const res = await fetch(
    `${strapiUrl}/api/orders?filters[customerEmail][$eq]=${encodeURIComponent(strapiUser.email)}&sort=createdAt:desc&populate=*`,
    { headers, cache: 'no-store' }
  )
  const json = res.ok ? ((await res.json()) as StrapiList<Order>) : { data: [] }
  const orders = json.data ?? []

  // Collect unique product slugs to fetch their images in one batch
  const allSlugs = [
    ...new Set(
      orders.flatMap((o) => o.lineItems?.map((i) => i.productSlug) ?? [])
    ),
  ]
  const imageMap: Record<string, string | undefined> = {}

  if (allSlugs.length > 0) {
    const slugParams = allSlugs
      .map((s, idx) => `filters[slug][$in][${idx}]=${encodeURIComponent(s)}`)
      .join('&')
    const prodRes = await fetch(
      `${strapiUrl}/api/products?${slugParams}&fields[0]=slug&populate[images]=true`,
      { headers, cache: 'no-store' }
    )
    if (prodRes.ok) {
      const prodJson = (await prodRes.json()) as StrapiList<Product>
      for (const p of prodJson.data ?? []) {
        const img = p.images?.[0]
        const url =
          img?.formats?.small?.url ?? img?.formats?.thumbnail?.url ?? img?.url
        imageMap[p.slug] = cleanImageUrl(url)
      }
    }
  }

  return (
    <div>
      <p className="font-[family-name:var(--font-geist-mono)] text-[15px] uppercase tracking-[0.18em] text-neutral-500">
        Espace client
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[0.01em] text-neutral-900 dark:text-white">
        Mes commandes
      </h1>

      {orders.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-neutral-500">Aucune commande pour le moment.</p>
          <Link
            href={`/${locale}/boutique`}
            className="mt-4 inline-block font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.1em] text-neutral-800 transition-colors hover:text-black dark:text-neutral-200 dark:hover:text-white"
          >
            Découvrir la boutique
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {orders.map((order) => {
            const firstItem = order.lineItems?.[0]
            const imgUrl = firstItem
              ? imageMap[firstItem.productSlug]
              : undefined
            const totalQty =
              order.lineItems?.reduce((s, i) => s + i.quantity, 0) ?? 0
            const otherCount = (order.lineItems?.length ?? 0) - 1

            return (
              <li key={order.documentId}>
                <Link
                  href={`/${locale}/espace-client/commandes/${order.documentId}`}
                  className="flex items-center gap-4 border border-neutral-200 bg-white p-4 shadow-sm hover:border-neutral-400 hover:shadow-md transition-all dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-500"
                >
                  {/* Product thumbnail */}
                  <div className="shrink-0 w-24 h-24 overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                    {imgUrl ? (
                      <Image
                        src={imgUrl}
                        alt={firstItem?.productName ?? ''}
                        width={96}
                        height={96}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-neutral-100" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xl mb-4 font-semibold text-neutral-900 truncate dark:text-white">
                      {firstItem?.productName ?? '—'}
                      {otherCount > 0 && (
                        <span className="ml-1.5 text-sm font-normal text-neutral-400">
                          +{otherCount} autre{otherCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm text-neutral-400">
                      {new Date(order.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                      {totalQty > 1 && ` · ${totalQty} articles`}
                    </p>
                    <p className="mt-1 font-[family-name:var(--font-geist-mono)] text-sm text-neutral-400">
                      #{order.documentId.slice(-8).toUpperCase()}
                    </p>
                  </div>

                  {/* Status + price */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-medium ${STATUS_COLORS[order.status] ?? 'bg-stone-100 text-stone-600'}`}
                    >
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                    <p className="font-semibold text-lg text-neutral-900 dark:text-white">
                      {formatPrice(order.total)}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
