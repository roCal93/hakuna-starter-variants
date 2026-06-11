import { redirect } from 'next/navigation'
import { getCurrentStrapiUser } from '@/lib/strapi-session-cookie'
import Link from 'next/link'
import Image from 'next/image'
import { formatPrice } from '@/lib/currency'
import { cleanImageUrl } from '@/lib/strapi'

interface StrapiList<T> {
  data: T[]
}

interface Order {
  documentId: string
  status: string
  createdAt: string
  total: number
  lineItems: { quantity: number; productName?: string; productSlug?: string }[]
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
  pending: 'bg-stone-100 text-stone-600 dark:bg-neutral-700 dark:text-neutral-300',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  shipped: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  refunded: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string
  value: number | string
  href: string
}) {
  return (
    <Link
      href={href}
      className="group border border-neutral-200 bg-white p-6 shadow-sm hover:border-neutral-400 hover:shadow-md transition-all dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-500"
    >
      <p className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">
        {value}
      </p>
      <p className="mt-1 font-[family-name:var(--font-geist-mono)] text-sm uppercase tracking-[0.08em] text-neutral-500 group-hover:text-neutral-700 transition-colors dark:text-neutral-400 dark:group-hover:text-neutral-200">
        {label}
      </p>
    </Link>
  )
}

export default async function TableauDeBordPage({
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

  const ordersRes = await fetch(
    `${strapiUrl}/api/orders?filters[customerEmail][$eq]=${encodeURIComponent(strapiUser.email)}&sort=createdAt:desc&pagination[limit]=3&populate=*`,
    { headers, cache: 'no-store' }
  ).then((r) => (r.ok ? (r.json() as Promise<StrapiList<Order>>) : { data: [] }))

  const orders = (ordersRes as StrapiList<Order>).data ?? []
  const lastOrder = orders[0] ?? null
  const lastOrderFirstItem = lastOrder?.lineItems?.[0] ?? null
  const lastOrderTotalQty =
    lastOrder?.lineItems?.reduce((s, i) => s + i.quantity, 0) ?? 0
  const lastOrderOtherCount = (lastOrder?.lineItems?.length ?? 0) - 1

  let lastOrderImageUrl: string | undefined
  if (lastOrderFirstItem?.productSlug) {
    const prodRes = await fetch(
      `${strapiUrl}/api/products?filters[slug][$eq]=${encodeURIComponent(lastOrderFirstItem.productSlug)}&fields[0]=slug&populate[images]=true`,
      { headers, cache: 'no-store' }
    )
    if (prodRes.ok) {
      const prodJson = (await prodRes.json()) as StrapiList<Product>
      const product = prodJson.data?.[0]
      const img = product?.images?.[0]
      const url =
        img?.formats?.small?.url ?? img?.formats?.thumbnail?.url ?? img?.url
      lastOrderImageUrl = cleanImageUrl(url)
    }
  }

  return (
    <div>
      <p className="font-[family-name:var(--font-geist-mono)] uppercase tracking-[0.18em] text-neutral-500">
        Espace client
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[0.01em] text-neutral-900 dark:text-white">
        Tableau de bord
      </h1>
      <p className="mt-4 text-neutral-500 dark:text-neutral-400">
        Bonjour {strapiUser.username}
      </p>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Commandes"
          value={orders.length}
          href={`/${locale}/espace-client/commandes`}
        />
        <StatCard
          label="Mon profil"
          value="→"
          href={`/${locale}/espace-client/profil`}
        />
      </div>

      {/* Last order */}
      {lastOrder && (
        <section className="mt-10">
          <h2 className="font-[family-name:var(--font-geist-mono)] uppercase tracking-[0.14em] text-neutral-500 mb-4">
            Dernière commande
          </h2>
          <Link
            href={`/${locale}/espace-client/commandes/${lastOrder.documentId}`}
            className="flex items-center gap-4 border border-neutral-200 bg-white p-4 shadow-sm hover:border-neutral-400 hover:shadow-md transition-all dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-500"
          >
            <div className="shrink-0 w-24 h-24 overflow-hidden bg-neutral-100 dark:bg-neutral-800">
              {lastOrderImageUrl ? (
                <Image
                  src={lastOrderImageUrl}
                  alt={lastOrderFirstItem?.productName ?? ''}
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-neutral-100" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xl mb-4 font-semibold text-neutral-900 truncate dark:text-white">
                {lastOrderFirstItem?.productName ?? 'Commande'}
                {lastOrderOtherCount > 0 && (
                  <span className="ml-1.5 text-sm font-normal text-neutral-400">
                    +{lastOrderOtherCount} autre
                    {lastOrderOtherCount > 1 ? 's' : ''}
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-sm text-neutral-400">
                {new Date(lastOrder.createdAt).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
                {lastOrderTotalQty > 1 && ` · ${lastOrderTotalQty} articles`}
              </p>
              <p className="mt-1 font-[family-name:var(--font-geist-mono)] text-sm text-neutral-400">
                #{lastOrder.documentId.slice(-8).toUpperCase()}
              </p>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-medium ${STATUS_COLORS[lastOrder.status] ?? 'bg-stone-100 text-stone-600'}`}
              >
                {STATUS_LABELS[lastOrder.status] ?? lastOrder.status}
              </span>
              <p className="font-semibold text-lg text-neutral-900 dark:text-white">
                {formatPrice(lastOrder.total)}
              </p>
            </div>
          </Link>
        </section>
      )}
    </div>
  )
}
