import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { toCents } from "@/lib/currency";
import type { CartItem } from "@/types/cart";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, locale = "fr" } = body as {
      items: CartItem[];
      locale?: string;
    };

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_SITE_URL is not configured" },
        { status: 500 }
      );
    }

    const lineItems: import("stripe").Stripe.Checkout.SessionCreateParams.LineItem[] =
      items.map((item) => ({
        price_data: {
          currency: "eur",
          unit_amount: toCents(item.price),
          product_data: {
            name: item.name,
            ...(item.imageUrl ? { images: [item.imageUrl] } : {}),
            metadata: {
              strapiId: String(item.id),
              slug: item.slug,
            },
          },
        },
        quantity: item.quantity,
      }));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      locale: locale === "fr" ? "fr" : "en",
      shipping_address_collection: {
        allowed_countries: ["FR", "BE", "CH", "LU", "MC"],
      },
      payment_method_types: ["card"],
      success_url: `${siteUrl}/${locale}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/${locale}/panier?cancelled=1`,
      metadata: {
        locale,
        cartItems: JSON.stringify(
          items.map((i) => ({
            id: i.id,
            documentId: i.documentId,
            name: i.name,
            slug: i.slug,
            price: i.price,
            quantity: i.quantity,
          }))
        ),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout/session]", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
