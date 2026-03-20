import type { MetadataRoute } from 'next'
import { createStrapiClient } from '@/lib/strapi-client'
import type { Page } from '@/types/strapi'
import { fetchBlogSitemapEntries } from '@/lib/blog'

const buildAbsoluteUrl = (path = '/'): string => {
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '')
  if (!path.startsWith('/')) {
    path = `/${path}`
  }
  return `${base}${path}`
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const client = createStrapiClient({
      apiUrl: process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337',
      apiToken: process.env.STRAPI_API_TOKEN,
    })
    const res = await client.findMany<Page>('pages', { populate: '*' })
    const blogEntries = await fetchBlogSitemapEntries()

    const pages = (res?.data || []).filter((p: Page) => !p.noIndex)
    const now = new Date()

    const pageEntries = pages.flatMap((page) => {
      const allLocales = [
        { locale: page.locale, slug: page.slug },
        ...(page.localizations || []),
      ]

      return allLocales.map((p) => {
        const isHome = !p.slug || p.slug === 'home'
        const path = isHome ? `/${p.locale}` : `/${p.locale}/${p.slug}`
        return {
          url: buildAbsoluteUrl(path),
          lastModified: now,
          changeFrequency: 'monthly' as const,
        }
      })
    })

    const blogIndexEntries = [
      {
        url: buildAbsoluteUrl('/fr/blog'),
        lastModified: now,
        changeFrequency: 'weekly' as const,
      },
      {
        url: buildAbsoluteUrl('/en/blog'),
        lastModified: now,
        changeFrequency: 'weekly' as const,
      },
    ]

    const blogArticleEntries = blogEntries.flatMap((article) => {
      const allLocales = [
        { locale: article.locale, slug: article.slug },
        ...(article.localizations || []),
      ].filter((entry) => entry.locale && entry.slug)

      return allLocales.map((entry) => ({
        url: buildAbsoluteUrl(`/${entry.locale}/blog/${entry.slug}`),
        lastModified: now,
        changeFrequency: 'weekly' as const,
      }))
    })

    return [...pageEntries, ...blogIndexEntries, ...blogArticleEntries]
  } catch (error) {
    console.error('Erreur lors de la génération du sitemap:', error)
    return [
      {
        url: buildAbsoluteUrl('/fr'),
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
      },
      {
        url: buildAbsoluteUrl('/en'),
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
      },
    ]
  }
}
