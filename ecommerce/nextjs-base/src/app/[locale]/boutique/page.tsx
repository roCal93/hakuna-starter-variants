import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "@/lib/currency";

// Strapi v5 — flat response format (no attributes wrapper)
interface StrapiImage {
  id: number;
  url: string;
  alternativeText: string | null;
}

interface StrapiCategory {
  id: number;
  documentId: string;
  name: string;
  slug: string;
}

interface StrapiProduct {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  price: number;
  compareAtPrice: number | null;
  active: boolean;
  stock: number;
  images: StrapiImage[] | null;
  category: StrapiCategory | null;
}

async function getProducts(locale: string): Promise<StrapiProduct[]> {
  const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL;
  const token = process.env.STRAPI_API_TOKEN;

  const url = new URL(`${strapiUrl}/api/products`);
  url.searchParams.set("locale", locale);
  url.searchParams.set("filters[active][$eq]", "true");
  url.searchParams.set("populate[images][fields][0]", "url");
  url.searchParams.set("populate[images][fields][1]", "alternativeText");
  url.searchParams.set("populate[category][fields][0]", "name");
  url.searchParams.set("populate[category][fields][1]", "slug");
  url.searchParams.set("sort", "createdAt:desc");
  url.searchParams.set("pagination[pageSize]", "100");

  const res = await fetch(url.toString(), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });

  if (!res.ok) return [];
  const json = (await res.json()) as { data: StrapiProduct[] };
  return json.data ?? [];
}

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ categorie?: string }>;
}

export default async function BoutiquePage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { categorie } = await searchParams;
  const products = await getProducts(locale);

  const categories = Array.from(
    new Map(
      products
        .map((p) => p.category)
        .filter((c): c is StrapiCategory => c !== null)
        .map((c) => [c.id, c])
    ).entries()
  ).map(([, cat]) => cat);

  const filtered = categorie
    ? products.filter((p) => p.category?.slug === categorie)
    : products;

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">
        {locale === "fr" ? "Boutique" : "Shop"}
      </h1>

      {/* Category filters */}
      {categories.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <Link
            href={`/${locale}/boutique`}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
              !categorie
                ? "bg-black text-white"
                : "bg-neutral-100 hover:bg-neutral-200"
            }`}
          >
            {locale === "fr" ? "Tout" : "All"}
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/${locale}/boutique?categorie=${cat.slug}`}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                categorie === cat.slug
                  ? "bg-black text-white"
                  : "bg-neutral-100 hover:bg-neutral-200"
              }`}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      )}

      {/* Products grid */}
      {filtered.length === 0 ? (
        <p className="text-neutral-500">
          {locale === "fr" ? "Aucun produit disponible." : "No products available."}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((product) => {
            const img = product.images?.[0];
            const imgUrl = img
              ? img.url.startsWith("http")
                ? img.url
                : `${process.env.NEXT_PUBLIC_STRAPI_URL}${img.url}`
              : null;

            return (
              <li key={product.id}>
                <Link
                  href={`/${locale}/boutique/${product.slug}`}
                  className="group block"
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-neutral-100">
                    {imgUrl && (
                      <Image
                        src={imgUrl}
                        alt={img?.alternativeText ?? product.name}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      />
                    )}
                  </div>
                  <div className="mt-3">
                    <p className="text-sm font-medium group-hover:underline">
                      {product.name}
                    </p>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-sm font-semibold">
                        {formatPrice(product.price)}
                      </span>
                      {product.compareAtPrice &&
                        product.compareAtPrice > product.price && (
                          <span className="text-xs text-neutral-400 line-through">
                            {formatPrice(product.compareAtPrice)}
                          </span>
                        )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
