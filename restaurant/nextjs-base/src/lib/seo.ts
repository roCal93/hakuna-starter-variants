// src/lib/seo.ts
import type { Metadata } from 'next'
import { createStrapiClient } from './strapi-client'
import { cleanImageUrl } from './strapi'
import type { Page, StrapiEntity } from '../types/strapi'

// --- Helper : construit le Metadata pour Next.js ---
export type Hreflang = {
  hreflang: string
  href: string
}

export function buildMetadata({
  title,
  description,
  image,
  noIndex,
  url,
  alternates,
}: {
  title?: string
  description?: string
  image?: string
  noIndex?: boolean
  url?: string
  alternates?: Hreflang[]
}): Metadata {
  // Fallback vers le logo du site si aucune image n'est fournie
  const siteBase = (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    'http://localhost:3000'
  ).replace(/\/$/, '')
  const ogImage = image || `${siteBase}/images/logo.png`

  return {
    title,
    description,

    robots: noIndex ? 'noindex, nofollow' : 'index, follow',

    alternates: {
      canonical: url,
      languages: alternates?.reduce(
        (acc, cur) => {
          acc[cur.hreflang] = cur.href
          return acc
        },
        {} as Record<string, string>
      ),
    },

    openGraph: {
      title,
      description,
      url,
      images: [
        {
          url: ogImage,
          width: image ? 1200 : 800,
          height: image ? 630 : 600,
          alt: title,
        },
      ],
      siteName: process.env.NEXT_PUBLIC_SITE_NAME || 'Restaurant',
      type: 'website',
      locale:
        alternates && alternates.length > 0
          ? alternates[0].hreflang
          : undefined,
    },

    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title,
      description,
      images: [ogImage],
      site: process.env.NEXT_PUBLIC_TWITTER_SITE,
      creator: process.env.NEXT_PUBLIC_TWITTER_CREATOR,
    },
  }
}

// --- Helper : récupère le SEO depuis Strapi ---
export async function getPageSEO(
  slug: string,
  draft = false,
  locale?: string
): Promise<Metadata | null> {
  try {
    const client = createStrapiClient({
      apiUrl: process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337',
      apiToken: process.env.STRAPI_API_TOKEN,
    })
    const res = await client.findMany<Page>('pages', {
      filters: { slug: { $eq: slug } },
      fields: ['seoTitle', 'title', 'seoDescription', 'noIndex', 'locale'],
      populate: {
        seoImage: {
          fields: ['url', 'alternativeText', 'width', 'height', 'formats'],
        },
        localizations: {
          fields: ['slug', 'locale'],
        },
      },
      locale: locale,
      publicationState: draft ? 'preview' : 'live',
    })

    // Strapi v5 : data[0] contient la page
    const page = res?.data?.[0]

    if (!page) return null

    // Gestion image (StrapiMedia ou undefined)
    let imageUrl: string | undefined = undefined
    if (page.seoImage && typeof page.seoImage === 'object') {
      imageUrl = cleanImageUrl(page.seoImage.url)
    }

    // Assure que l'URL de l'image est absolue
    const siteBase = (
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.SITE_URL ??
      'https://example.com'
    ).replace(/\/$/, '')
    const strapiBase = (
      process.env.NEXT_PUBLIC_STRAPI_URL ?? 'http://localhost:1337'
    ).replace(/\/$/, '')
    if (imageUrl && imageUrl.startsWith('/')) {
      imageUrl = `${strapiBase}${imageUrl}`
    }

    // Gestion description (StrapiBlock[] ou string)
    let description: string | undefined = undefined
    if (Array.isArray(page.seoDescription)) {
      // On extrait le texte des blocks (simple)
      description = page.seoDescription
        .map((b) => b.children?.map((c) => c.text).join(' ') ?? '')
        .join(' ')
    } else if (typeof page.seoDescription === 'string') {
      description = page.seoDescription
    }

    const pageLocale = page.locale ?? locale ?? 'fr'
    const canonical = `${siteBase}/${pageLocale}/${slug}`

    const localizations = page.localizations ?? []
    const alternatesArr: Hreflang[] = [
      { hreflang: pageLocale, href: canonical },
      ...localizations.map((l: Page & StrapiEntity) => ({
        hreflang: l.locale || 'fr',
        href: `${siteBase}/${l.locale || 'fr'}/${slug}`,
      })),
      // x-default for unmatched locales
      { hreflang: 'x-default', href: `${siteBase}/fr/${slug}` },
    ]

    return buildMetadata({
      title: page.seoTitle || page.title || 'Hakuna Mataweb',
      description,
      image: imageUrl,
      noIndex: page.noIndex,
      url: canonical,
      alternates: alternatesArr,
    })
  } catch (error) {
    console.error('Erreur getPageSEO:', error)
    return null
  }
}
