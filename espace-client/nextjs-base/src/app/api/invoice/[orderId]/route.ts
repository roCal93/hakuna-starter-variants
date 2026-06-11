import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  Document,
  type DocumentProps,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'
import { createElement, type ReactElement } from 'react'
import { formatPrice } from '@/lib/currency'

export const runtime = 'nodejs'

interface LineItem {
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
}

function asText(value: unknown, fallback = '-'): string {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : fallback
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return fallback
}

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1c1917',
  },
  header: { marginBottom: 32 },
  title: {
    fontSize: 22,
    fontFamily: 'Helvetica',
    fontWeight: 700,
    marginBottom: 4,
  },
  subtitle: { fontSize: 10, color: '#78716c' },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica',
    fontWeight: 700,
    marginBottom: 8,
    color: '#44403c',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  bold: { fontFamily: 'Helvetica', fontWeight: 700 },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#e7e5e4',
    marginVertical: 12,
  },
  footer: { marginTop: 40, fontSize: 8, color: '#a8a29e', textAlign: 'center' },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f5f5f4',
    color: '#57534e',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 9,
    marginBottom: 12,
  },
})

function InvoiceDocument({ order }: { order: Order }) {
  const refNum = asText(order.documentId, 'INCONNU').slice(-8).toUpperCase()
  const date = new Date(order.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const lineItems = Array.isArray(order.lineItems) ? order.lineItems : []
  const shippingAddress = order.shippingAddress ?? null
  const shippingFullName = shippingAddress
    ? `${asText(shippingAddress.firstName, 'Client')} ${asText(shippingAddress.lastName, '')}`.trim()
    : ''
  const shippingAddressLines: ReactElement[] = []

  if (shippingAddress) {
    shippingAddressLines.push(
      createElement(Text, null, shippingFullName || 'Client')
    )
    shippingAddressLines.push(
      createElement(
        Text,
        null,
        asText(shippingAddress.address1, 'Adresse non fournie')
      )
    )
    if (shippingAddress.address2) {
      shippingAddressLines.push(
        createElement(Text, null, asText(shippingAddress.address2))
      )
    }
    shippingAddressLines.push(
      createElement(
        Text,
        null,
        `${asText(shippingAddress.postalCode, '00000')} ${asText(shippingAddress.city, 'Ville inconnue')} - ${asText(shippingAddress.country, 'FR')}`
      )
    )
  }

  return createElement(
    Document,
    null,
    createElement(
      Page,
      { size: 'A4', style: styles.page },
      // Header
      createElement(
        View,
        { style: styles.header },
        createElement(
          Text,
          { style: styles.title },
          'La Montre de Mon Grand-Père'
        ),
        createElement(
          Text,
          { style: styles.subtitle },
          'Facture / Bon de commande'
        )
      ),
      // Meta
      createElement(
        View,
        { style: styles.section },
        createElement(
          Text,
          { style: styles.badge },
          `Statut : ${asText(order.status, 'inconnu').toUpperCase()}`
        ),
        createElement(
          View,
          { style: styles.row },
          createElement(Text, null, `Référence : #${refNum}`),
          createElement(Text, null, `Date : ${date}`)
        ),
        createElement(
          View,
          { style: styles.row },
          createElement(
            Text,
            null,
            `Client : ${asText(order.customerName, 'Client')}`
          ),
          createElement(Text, null, asText(order.customerEmail, '-'))
        )
      ),
      // Divider
      createElement(View, { style: styles.divider }),
      // Line items
      createElement(
        View,
        { style: styles.section },
        createElement(Text, { style: styles.sectionTitle }, 'Articles'),
        ...lineItems.map((item, i) =>
          createElement(
            View,
            { key: i, style: styles.row },
            createElement(
              Text,
              null,
              `${asText(item.productName, 'Article')} x${Number(item.quantity) || 0}`
            ),
            createElement(
              Text,
              { style: styles.bold },
              formatPrice(
                (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0)
              )
            )
          )
        )
      ),
      // Divider
      createElement(View, { style: styles.divider }),
      // Totals
      createElement(
        View,
        { style: styles.section },
        createElement(
          View,
          { style: styles.row },
          createElement(Text, null, 'Sous-total'),
          createElement(Text, null, formatPrice(order.subtotal))
        ),
        createElement(
          View,
          { style: styles.row },
          createElement(Text, null, 'Livraison'),
          createElement(
            Text,
            null,
            order.shippingCost === 0
              ? 'Offerte'
              : formatPrice(order.shippingCost)
          )
        ),
        createElement(View, { style: styles.divider }),
        createElement(
          View,
          { style: styles.row },
          createElement(Text, { style: styles.bold }, 'Total'),
          createElement(Text, { style: styles.bold }, formatPrice(order.total))
        )
      ),
      // Shipping address
      shippingAddress
        ? createElement(
            View,
            { style: styles.section },
            createElement(
              Text,
              { style: styles.sectionTitle },
              'Adresse de livraison'
            ),
            ...shippingAddressLines
          )
        : null,
      // Footer
      createElement(
        Text,
        { style: styles.footer },
        'La Montre de Mon Grand-Père — Document généré automatiquement'
      )
    )
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth()
  const sessionEmail = session?.user?.email?.trim().toLowerCase()
  if (!session || !sessionEmail) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { orderId } = await params
  const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL
  const token = process.env.STRAPI_API_TOKEN

  if (!strapiUrl || !token) {
    return NextResponse.json(
      { error: 'Configuration serveur manquante' },
      { status: 500 }
    )
  }

  const query =
    `${strapiUrl}/api/orders` +
    `?filters[documentId][$eq]=${encodeURIComponent(orderId)}` +
    `&filters[customerEmail][$eqi]=${encodeURIComponent(sessionEmail)}` +
    '&populate=*'

  const res = await fetch(query, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
  }

  const json = (await res.json()) as { data?: Order[] }
  const order = json.data?.[0]
  if (!order) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const PDF_TIMEOUT_MS = 25_000
  const PDF_TIMEOUT_ERROR = `PDF generation timed out after ${PDF_TIMEOUT_MS}ms`

  try {
    const pdfDocument = createElement(InvoiceDocument, {
      order,
    }) as unknown as ReactElement<DocumentProps>

    const buffer: Buffer = await Promise.race([
      renderToBuffer(pdfDocument),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(PDF_TIMEOUT_ERROR)), PDF_TIMEOUT_MS)
      ),
    ])

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="facture-${order.documentId.slice(-8).toUpperCase()}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Invoice PDF generation failed', {
      orderId: order.documentId,
      error,
    })

    if (error instanceof Error && error.message === PDF_TIMEOUT_ERROR) {
      return NextResponse.json(
        { error: 'La génération de la facture a expiré. Réessayez.' },
        { status: 504 }
      )
    }

    return NextResponse.json(
      { error: 'Erreur de generation de facture' },
      { status: 500 }
    )
  }
}
