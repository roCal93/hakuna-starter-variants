import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { toCents } from "@/lib/currency";
import type { CartItem } from "@/types/cart";

interface StrapiProductPrice {
  documentId: string;
  price: number;
  name: string;
  active: boolean;
}

/**
 * Fetch the authoritative prices from Strapi for the given documentIds.
 * This prevents clients from sending manipulated prices.
 */
async function fetchProductPricesFromStrapi(
  documentIds: string[]
): Promise<Map<string, StrapiProductPrice>> {
  const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL;
  const token = process.env.STRAPI_API_TOKEN;
  if (!strapiUrl || !token || documentIds.length === 0) {
    return new Map();
  }

  const url = new URL(`${strapiUrl}/api/products`);
  documentIds.forEach((id, i) => {
    url.searchParams.set(`filters[documentId][$in][${i}]`, id);
  });
  url.searchParams.set("fields[0]", "documentId");
  url.searchParams.set("fields[1]", "price");
  url.searchParams.set("fields[2]", "name");
  url.searchParams.set("fields[3]", "active");
  url.searchParams.set("pagination[pageSize]", String(documentIds.length));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return new Map();

  const json = (await res.json()) as { data?: StrapiProductPrice[] };
  const map = new Map<string, StrapiProductPrice>();
  for (const product of json.data ?? []) {
    map.set(product.documentId, product);
  }
  return map;
}

/** Return only publicly accessible image URLs (Stripe can't reach localhost) */
function toPublicImageUrl(url: string | null | undefined): string[] {
  if (!url) return [];
  if (url.startsWith("http://localhost") || url.startsWith("http://127."))
    return [];
  return [url];
}

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

    // Re-fetch authoritative prices from Strapi — never trust client-provided prices.
    const documentIds = items
      .map((i) => i.documentId)
      .filter((id): id is string => Boolean(id));
    const strapiPrices = await fetchProductPricesFromStrapi(documentIds);

    if (strapiPrices.size === 0) {
      return NextResponse.json(
        { error: "Impossible de vérifier les prix des produits" },
        { status: 502 }
      );
    }

    // Reject if any item is not found in Strapi or is no longer active
    for (const item of items) {
      const strapiProduct = strapiPrices.get(item.documentId);
      if (!strapiProduct) {
        return NextResponse.json(
          { error: `Produit introuvable : ${item.name}` },
          { status: 400 }
        );
      }
      if (!strapiProduct.active) {
        return NextResponse.json(
          { error: `Ce produit n'est plus disponible : ${item.name}` },
          { status: 400 }
        );
      }
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_SITE_URL is not configured" },
        { status: 500 }
      );
    }

    const lineItems = items.map((item) => {
      // Use the server-side price from Strapi, never the client-supplied one
      const verifiedPrice = strapiPrices.get(item.documentId)!.price;
      return {
        price_data: {
          currency: "eur",
          unit_amount: toCents(verifiedPrice),
          product_data: {
            name: item.name,
            images: toPublicImageUrl(item.imageUrl),
            metadata: {
              strapiId: String(item.id),
              slug: item.slug,
            },
          },
        },
        quantity: item.quantity,
      };
    });

    const session = await getStripe().checkout.sessions.create({
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
            // Always use the server-verified price in metadata
            price: strapiPrices.get(i.documentId)!.price,
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
