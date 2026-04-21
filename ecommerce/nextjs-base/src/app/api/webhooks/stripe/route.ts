import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { validateStripeWebhookSignature } from '@/lib/webhook-validation'
import { checkRateLimit } from '@/lib/rate-limit'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

// Stripe requires the raw body to validate the signature — disable body parsing.
export const dynamic = 'force-dynamic'

async function persistWebhookError(params: {
  eventId: string
  eventType: string
  error: unknown
}): Promise<void> {
  const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL
  const writeToken = process.env.STRAPI_WRITE_API_TOKEN
  const collection =
    process.env.STRAPI_WEBHOOK_ERROR_COLLECTION || 'webhook-errors'

  if (!strapiUrl || !writeToken) return

  const message =
    params.error instanceof Error
      ? params.error.message
      : String(params.error ?? 'Unknown error')
  const stack =
    params.error instanceof Error && params.error.stack
      ? params.error.stack.slice(0, 4000)
      : null

  try {
    const response = await fetch(`${strapiUrl}/api/${collection}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${writeToken}`,
      },
      body: JSON.stringify({
        data: {
          provider: 'stripe',
          eventId: params.eventId,
          eventType: params.eventType,
          message,
          stack,
          occurredAt: new Date().toISOString(),
        },
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      console.warn(
        `[webhook] Failed to persist error log (${response.status}): ${text}`
      )
    }
  } catch (persistErr) {
    console.warn('[webhook] Failed to persist webhook error log:', persistErr)
  }
}

function isDuplicateStripeSessionError(
  status: number,
  responseText: string
): boolean {
  if (status !== 400 && status !== 409) return false

  const body = responseText.toLowerCase()
  return (
    body.includes('stripesessionid') &&
    (body.includes('unique') ||
      body.includes('already') ||
      body.includes('taken') ||
      body.includes('duplicate'))
  )
}

async function createOrderInStrapi(
  session: Stripe.Checkout.Session
): Promise<{ created: boolean }> {
  const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL
  const writeToken = process.env.STRAPI_WRITE_API_TOKEN

  if (!strapiUrl || !writeToken) {
    throw new Error('Strapi env vars (URL or WRITE TOKEN) are not configured')
  }

  const cartItems = session.metadata?.cartItems
    ? (JSON.parse(session.metadata.cartItems) as Array<{
        id: number
        name: string
        slug: string
        price: number
        quantity: number
      }>)
    : []

  const locale = session.metadata?.locale ?? 'fr'

  const lineItems = cartItems.map((item) => ({
    productId: String(item.id),
    productName: item.name,
    productSlug: item.slug,
    quantity: item.quantity,
    unitPrice: item.price,
    total: item.price * item.quantity,
  }))

  const subtotal = lineItems.reduce((sum, li) => sum + li.total, 0)
  const shippingCost = session.shipping_cost
    ? session.shipping_cost.amount_total / 100
    : 0
  const total = subtotal + shippingCost

  // Resolve shipping data from multiple sources for Stripe API version compatibility
  const shippingName =
    session.collected_information?.shipping_details?.name ??
    session.customer_details?.name ??
    ''

  const nameParts = shippingName.split(' ').filter(Boolean)
  const firstName = nameParts[0] ?? 'Client'
  const lastName = nameParts.slice(1).join(' ') || 'Stripe'

  const shippingDetails =
    session.collected_information?.shipping_details?.address ??
    session.customer_details?.address ??
    null

  const shippingAddress = {
    firstName,
    lastName,
    address1: shippingDetails?.line1 || 'Adresse non fournie',
    address2: shippingDetails?.line2 || '',
    city: shippingDetails?.city || 'Ville inconnue',
    postalCode: shippingDetails?.postal_code || '00000',
    country: shippingDetails?.country || 'FR',
    phone: session.customer_details?.phone ?? '',
  }

  const orderPayload = {
    data: {
      stripeSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : (session.payment_intent?.id ?? null),
      status: 'paid',
      customerEmail: session.customer_details?.email ?? '',
      customerName: session.customer_details?.name ?? '',
      lineItems,
      shippingAddress,
      subtotal,
      shippingCost,
      total,
      currency: session.currency ?? 'eur',
      locale,
    },
  }

  const response = await fetch(`${strapiUrl}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${writeToken}`,
    },
    body: JSON.stringify(orderPayload),
  })

  if (!response.ok) {
    const text = await response.text()
    if (isDuplicateStripeSessionError(response.status, text)) {
      console.info(
        `[webhook] Duplicate session ignored (already processed): ${session.id}`
      )
      return { created: false }
    }
    throw new Error(
      `Strapi order creation failed (${response.status}): ${text}`
    )
  }

  return { created: true }
}

async function decrementStockInStrapi(
  cartItems: Array<{ id: number; documentId: string; slug: string; quantity: number }>
): Promise<void> {
  const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL
  const writeToken = process.env.STRAPI_WRITE_API_TOKEN

  if (!strapiUrl || !writeToken) return

  await Promise.all(
    cartItems.map(async (item) => {
      const getRes = await fetch(
        `${strapiUrl}/api/products/${item.id}?fields[0]=stock&fields[1]=active`,
        { headers: { Authorization: `Bearer ${writeToken}` } }
      )
      if (!getRes.ok) return

      const { data } = (await getRes.json()) as { data: { stock: number; active: boolean } }
      const newStock = Math.max(0, (data.stock ?? 0) - item.quantity)

      await fetch(`${strapiUrl}/api/products/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${writeToken}`,
        },
        body: JSON.stringify({ data: { stock: newStock } }),
      })
    })
  )
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  let event: Stripe.Event
  try {
    const rawBody = await request.text()
    event = validateStripeWebhookSignature(rawBody, signature)
  } catch (err) {
    console.error('[webhook] Signature validation failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Idempotency guard: ignore duplicate delivery of the same Stripe event
  const eventDedup = await checkRateLimit({
    key: `stripe:event:${event.id}`,
    limit: 1,
    windowMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  })
  if (!eventDedup.allowed) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.payment_status === 'paid') {
          const { created } = await createOrderInStrapi(session)
          if (!created) break

          const cartItems = session.metadata?.cartItems
            ? (JSON.parse(session.metadata.cartItems) as Array<{
                id: number
                documentId: string
                slug: string
                quantity: number
              }>)
            : []
          const locale = session.metadata?.locale ?? 'fr'
          await decrementStockInStrapi(cartItems)
          revalidateTag('products', {})
          revalidatePath(`/${locale}/boutique`, 'page')
          for (const item of cartItems) {
            revalidatePath(`/${locale}/boutique/${item.slug}`, 'page')
          }
        }
        break
      }
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session
        const { created } = await createOrderInStrapi(session)
        if (!created) break

        const cartItems = session.metadata?.cartItems
          ? (JSON.parse(session.metadata.cartItems) as Array<{
              id: number
              documentId: string
              slug: string
              quantity: number
            }>)
          : []
        const locale2 = session.metadata?.locale ?? 'fr'
        await decrementStockInStrapi(cartItems)
        revalidateTag('products', {})
        revalidatePath(`/${locale2}/boutique`, 'page')
        for (const item of cartItems) {
          revalidatePath(`/${locale2}/boutique/${item.slug}`, 'page')
        }
        break
      }
      default:
        break
    }
  } catch (err) {
    await persistWebhookError({
      eventId: event.id,
      eventType: event.type,
      error: err,
    })

    console.error(
      `[webhook] Failed to process event ${event.type} (${event.id}):`,
      err
    )
    return NextResponse.json(
      { error: 'Webhook handler error' },
      { status: 500 }
    )
  }

  return NextResponse.json({ received: true })
}
