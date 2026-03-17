import Image from "next/image";
import { notFound } from "next/navigation";
import { formatPrice } from "@/lib/currency";
import { AddToCartButton } from "./AddToCartButton";

// Strapi v5 — flat response format (no attributes wrapper)
interface StrapiImage {
  id: number;
  url: string;
  alternativeText: string | null;
}

interface StrapiProduct {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  active: boolean;
  images: StrapiImage[] | null;
  category: { id: number; documentId: string; name: string; slug: string } | null;
}

async function getProduct(
  slug: string,
  locale: string
): Promise<StrapiProduct | null> {
  const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL;
  const token = process.env.STRAPI_API_TOKEN;

  const url = new URL(`${strapiUrl}/api/products`);
  url.searchParams.set("filters[slug][$eq]", slug);
  url.searchParams.set("locale", locale);
  url.searchParams.set("fields[0]", "name");
  url.searchParams.set("fields[1]", "slug");
  url.searchParams.set("fields[2]", "description");
  url.searchParams.set("fields[3]", "shortDescription");
  url.searchParams.set("fields[4]", "price");
  url.searchParams.set("fields[5]", "compareAtPrice");
  url.searchParams.set("fields[6]", "stock");
  url.searchParams.set("fields[7]", "active");
  url.searchParams.set("populate[images][fields][0]", "url");
  url.searchParams.set("populate[images][fields][1]", "alternativeText");
  url.searchParams.set("populate[category][fields][0]", "name");
  url.searchParams.set("populate[category][fields][1]", "slug");

  const res = await fetch(url.toString(), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });

  if (!res.ok) return null;
  const json = (await res.json()) as { data: StrapiProduct[] };
  return json.data?.[0] ?? null;
}

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function ProductPage({ params }: Props) {
  const { locale, slug } = await params;
  const product = await getProduct(slug, locale);

  if (!product || !product.active) {
    notFound();
  }

  const { name, description, price, compareAtPrice, stock, images } = product;

  const buildImgUrl = (rawUrl: string) =>
    rawUrl.startsWith("http")
      ? rawUrl
      : `${process.env.NEXT_PUBLIC_STRAPI_URL}${rawUrl}`;

  const imgs = images ?? [];
  const firstImg = imgs[0];

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        {/* Images */}
        <div className="space-y-3">
          <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-neutral-100">
            {firstImg ? (
              <Image
                src={buildImgUrl(firstImg.url)}
                alt={firstImg.alternativeText ?? name}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            ) : (
              <div className="h-full w-full bg-neutral-200" />
            )}
          </div>
          {imgs.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {imgs.slice(1).map((img) => (
                <div
                  key={img.id}
                  className="relative aspect-square overflow-hidden rounded-lg bg-neutral-100"
                >
                  <Image
                    src={buildImgUrl(img.url)}
                    alt={img.alternativeText ?? name}
                    fill
                    className="object-cover"
                    sizes="128px"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{name}</h1>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-2xl font-semibold">{formatPrice(price)}</span>
              {compareAtPrice && compareAtPrice > price && (
                <span className="text-base text-neutral-400 line-through">
                  {formatPrice(compareAtPrice)}
                </span>
              )}
            </div>
          </div>

          {description && (
            <div
              className="prose prose-sm max-w-none text-neutral-700"
              dangerouslySetInnerHTML={{ __html: description }}
            />
          )}

          <AddToCartButton
            product={{
              id: product.id,
              documentId: product.documentId,
              name,
              slug,
              price,
              imageUrl: firstImg ? buildImgUrl(firstImg.url) : null,
              stock,
            }}
          />

          <p className="text-xs text-neutral-400">
            Livraison calculée au moment du paiement.
          </p>
        </div>
      </div>
    </main>
  );
}
