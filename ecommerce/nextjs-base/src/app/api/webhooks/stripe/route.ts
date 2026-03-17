import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { validateStripeWebhookSignature } from "@/lib/webhook-validation";
import type Stripe from "stripe";

export const runtime = "nodejs";

// Stripe requires the raw body to validate the signature — disable body parsing.
export const dynamic = "force-dynamic";

async function createOrderInStrapi(
  session: Stripe.Checkout.Session
): Promise<void> {
  const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL;
  const writeToken = process.env.STRAPI_WRITE_API_TOKEN;

  if (!strapiUrl || !writeToken) {
    throw new Error("Strapi env vars (URL or WRITE TOKEN) are not configured");
  }

  const cartItems = session.metadata?.cartItems
    ? (JSON.parse(session.metadata.cartItems) as Array<{
        id: number;
        name: string;
        slug: string;
        price: number;
        quantity: number;
      }>)
    : [];

  const locale = session.metadata?.locale ?? "fr";

  const lineItems = cartItems.map((item) => ({
    productId: String(item.id),
    productName: item.name,
    productSlug: item.slug,
    quantity: item.quantity,
    unitPrice: item.price,
    total: item.price * item.quantity,
  }));

  const subtotal = lineItems.reduce((sum, li) => sum + li.total, 0);
  const shippingCost = session.shipping_cost
    ? session.shipping_cost.amount_total / 100
    : 0;
  const total = subtotal + shippingCost;

  const shippingDetails = session.shipping_details?.address;
  const shippingAddress = shippingDetails
    ? {
        firstName:
          session.shipping_details?.name?.split(" ")[0] ??
          session.customer_details?.name?.split(" ")[0] ??
          "",
        lastName:
          session.shipping_details?.name?.split(" ").slice(1).join(" ") ??
          session.customer_details?.name?.split(" ").slice(1).join(" ") ??
          "",
        address1: shippingDetails.line1 ?? "",
        address2: shippingDetails.line2 ?? "",
        city: shippingDetails.city ?? "",
        postalCode: shippingDetails.postal_code ?? "",
        country: shippingDetails.country ?? "FR",
        phone: session.customer_details?.phone ?? "",
      }
    : {
        firstName: "",
        lastName: "",
        address1: "",
        city: "",
        postalCode: "",
        country: "FR",
      };

  const orderPayload = {
    data: {
      stripeSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null),
      status: "paid",
      customerEmail: session.customer_details?.email ?? "",
      customerName: session.customer_details?.name ?? "",
      lineItems,
      shippingAddress,
      subtotal,
      shippingCost,
      total,
      currency: session.currency ?? "eur",
      locale,
    },
  };

  const response = await fetch(`${strapiUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${writeToken}`,
    },
    body: JSON.stringify(orderPayload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Strapi order creation failed (${response.status}): ${text}`);
  }
}

async function decrementStockInStrapi(
  cartItems: Array<{ id: number; documentId: string; slug: string; quantity: number }>
): Promise<void> {
  const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL;
  const writeToken = process.env.STRAPI_WRITE_API_TOKEN;

  if (!strapiUrl || !writeToken) return;

  await Promise.all(
    cartItems.map(async (item) => {
      const getRes = await fetch(
        `${strapiUrl}/api/products/${item.id}?fields[0]=stock&fields[1]=active`,
        { headers: { Authorization: `Bearer ${writeToken}` } }
      );
      if (!getRes.ok) return;
      const { data } = (await getRes.json()) as {
        data: { stock: number; active: boolean };
      };

      const newStock = Math.max(0, (data.stock ?? 0) - item.quantity);
      const updatePayload: Record<string, unknown> = { stock: newStock };


      await fetch(`${strapiUrl}/api/products/${item.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${writeToken}`,
        },
        body: JSON.stringify({ data: updatePayload }),
      });
    })
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = validateStripeWebhookSignature(rawBody, signature);
  } catch (err) {
    console.error("[webhook] Signature validation failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status === "paid") {
          await createOrderInStrapi(session);
          const cartItems = session.metadata?.cartItems
            ? (JSON.parse(session.metadata.cartItems) as Array<{ id: number; documentId: string; slug: string; quantity: number }>)
            : [];
          const locale = session.metadata?.locale ?? "fr";
          await decrementStockInStrapi(cartItems);
          revalidatePath(`/${locale}/boutique`, "page");
          for (const item of cartItems) {
            revalidatePath(`/${locale}/boutique/${item.slug}`, "page");
          }
        }
        break;
      }
      // Handle async payment confirmation (e.g. bank transfer)
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        const cartItems = session.metadata?.cartItems
          ? (JSON.parse(session.metadata.cartItems) as Array<{ id: number; documentId: string; slug: string; quantity: number }>)
          : [];
        const locale2 = session.metadata?.locale ?? "fr";
        await createOrderInStrapi(session);
        await decrementStockInStrapi(cartItems);
        revalidatePath(`/${locale2}/boutique`, "page");
        for (const item of cartItems) {
          revalidatePath(`/${locale2}/boutique/${item.slug}`, "page");
        }
        break;
      }
      default:
        // Ignore unhandled events
        break;
    }
  } catch (err) {
    console.error(`[webhook] Failed to process event ${event.type}:`, err);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
