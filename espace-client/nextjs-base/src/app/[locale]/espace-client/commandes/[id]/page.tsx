import { redirect, notFound } from 'next/navigation'
import { getCurrentStrapiUser } from '@/lib/strapi-session-cookie'
import Link from 'next/link'
import Image from 'next/image'
import { formatPrice } from '@/lib/currency'
import { cleanImageUrl } from '@/lib/strapi'

interface LineItem {
  id: number
  productName: string
  productSlug: string
  quantity: number
  unitPrice: number
  total: number
}

interface ShippingAddress {
  firstName: string
  lastName: string
  address1: string
  address2?: string
  city: string
  postalCode: string
  country: string
  phone?: string
}
interface ProductImage {
  formats?: { small?: { url: string }; thumbnail?: { url: string } }
  url: string
}

interface Product {
  slug: string
  images: ProductImage[]
}
interface Order {
  documentId: string
  status: string
  createdAt: string
  customerEmail: string
  customerName: string
  lineItems: LineItem[]
  shippingAddress: ShippingAddress
  subtotal: number
  shippingCost: number
  total: number
  currency: string
  notes?: string
}

interface StrapiList<T> {
  data: T[]
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

export default async function CommandeDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  const strapiUser = await getCurrentStrapiUser()
  if (!strapiUser) redirect(`/${locale}/espace-client/connexion`)
  const sessionEmail = strapiUser.email.trim().toLowerCase()

  const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL
  const token = process.env.STRAPI_API_TOKEN
  const query =
    `${strapiUrl}/api/orders` +
    `?filters[documentId][$eq]=${encodeURIComponent(id)}` +
    `&filters[customerEmail][$eqi]=${encodeURIComponent(sessionEmail)}` +
    '&populate=*'

  const res = await fetch(query, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) notFound()
  const json = (await res.json()) as StrapiList<Order>
  const order = json.data?.[0]
  if (!order) notFound()

  const addr = order.shippingAddress

  const productSlugs = [
    ...new Set(order.lineItems?.map((item) => item.productSlug) ?? []),
  ]
  const productImages: Record<string, string | undefined> = {}

  if (productSlugs.length > 0) {
    const slugParams = productSlugs
      .map(
        (slug, index) =>
          `filters[slug][$in][${index}]=${encodeURIComponent(slug)}`
      )
      .join('&')

    const productsRes = await fetch(
      `${strapiUrl}/api/products?${slugParams}&populate[images]=true`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
    )

    if (productsRes.ok) {
      const productsJson = (await productsRes.json()) as { data: Product[] }
      for (const p of productsJson.data ?? []) {
        const img = p.images?.[0]
        const rawUrl =
          img?.formats?.small?.url ?? img?.formats?.thumbnail?.url ?? img?.url
        productImages[p.slug] = cleanImageUrl(rawUrl)
      }
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Link
          href={`/${locale}/espace-client/commandes`}
          className="text-sm text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          ← Mes commandes
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4 mt-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-neutral-900 dark:text-white">
            Commande #{order.documentId.slice(-8).toUpperCase()}
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {new Date(order.createdAt).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        <span
          className={`shrink-0 inline-flex rounded-full px-3 py-1 text-sm font-medium ${STATUS_COLORS[order.status] ?? 'bg-stone-100 text-stone-600'}`}
        >
          {STATUS_LABELS[order.status] ?? order.status}
        </span>
      </div>

      {/* Articles */}
      <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        <h2 className="text-base font-semibold text-neutral-800 mb-4 dark:text-neutral-100">
          {(order.lineItems?.reduce((s, i) => s + i.quantity, 0) ?? 0) > 1
            ? 'Articles'
            : 'Article'}
        </h2>
        <ul className="divide-y divide-neutral-100 dark:divide-neutral-700">
          {order.lineItems?.map((item, i) => {
            const imageUrl = productImages[item.productSlug]
            return (
              <li key={i} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-700">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={item.productName}
                        width={56}
                        height={56}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-neutral-100" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                      {item.productName}
                    </p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">
                      × {item.quantity}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-medium text-neutral-900 dark:text-white">
                  {formatPrice(item.unitPrice * item.quantity)}
                </p>
              </li>
            )
          })}
        </ul>

        <div className="mt-4 space-y-1.5 border-t border-neutral-100 pt-4 dark:border-neutral-700">
          <div className="flex justify-between text-sm text-neutral-500 dark:text-neutral-400">
            <span>Sous-total</span>
            <span>{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-neutral-500 dark:text-neutral-400">
            <span>Livraison</span>
            <span>
              {order.shippingCost === 0
                ? 'Offerte'
                : formatPrice(order.shippingCost)}
            </span>
          </div>
          <div className="flex justify-between text-sm font-semibold text-neutral-900 pt-1.5 border-t border-neutral-100 dark:text-white dark:border-neutral-700">
            <span>Total</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </div>
      </section>

      {/* Shipping address */}
      {addr && (
        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <h2 className="text-base font-semibold text-neutral-800 mb-3 dark:text-neutral-100">
            Adresse de livraison
          </h2>
          <address className="not-italic text-sm text-neutral-600 leading-6 dark:text-neutral-300">
            <p className="font-medium text-neutral-800 dark:text-neutral-100">
              {addr.firstName} {addr.lastName}
            </p>
            <p>{addr.address1}</p>
            {addr.address2 && <p>{addr.address2}</p>}
            <p>
              {addr.postalCode} {addr.city}
            </p>
            <p>{addr.country}</p>
          </address>
        </section>
      )}

      {/* Invoice download */}
      <div className="mt-6">
        <a
          href={`/api/invoice/${order.documentId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-5 py-2.5 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 transition-colors dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          ↓ Télécharger la facture (PDF)
        </a>
      </div>
    </div>
  )
}
