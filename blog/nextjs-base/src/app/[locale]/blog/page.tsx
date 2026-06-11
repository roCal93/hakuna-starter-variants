import Image from 'next/image'
import Link from 'next/link'
import { fetchBlogArticles } from '@/lib/blog'
import { createStrapiClient } from '@/lib/strapi-client'
import { SectionGeneric } from '@/components/sections/SectionGeneric'
import type { DynamicBlock } from '@/types/custom'
import type { Page, PageCollectionResponse, StrapiEntity } from '@/types/strapi'

export const revalidate = 3600

interface Props {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ page?: string }>
}

const PAGE_SIZE = 9

const normalizeContainerWidth = (
  width: unknown
): 'small' | 'medium' | 'large' | 'full' => {
  if (
    width === 'small' ||
    width === 'medium' ||
    width === 'large' ||
    width === 'full'
  ) {
    return width
  }

  return 'medium'
}

const fetchBlogLandingPage = async ({
  locale,
  isDraft,
}: {
  locale: string
  isDraft: boolean
}): Promise<(Page & StrapiEntity) | null> => {
  const apiToken = isDraft
    ? process.env.STRAPI_PREVIEW_TOKEN || process.env.STRAPI_API_TOKEN
    : process.env.STRAPI_API_TOKEN

  const client = createStrapiClient({
    apiUrl: process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337',
    apiToken,
  })

  const pageRes: PageCollectionResponse = await client.findMany('pages', {
    filters: { slug: { $eq: 'blog' } },
    fields: ['title', 'hideTitle', 'slug'],
    populate:
      'sections.blocks.cards.image,sections.blocks.image,sections.blocks.imageDesktop,sections.blocks.buttons.file,sections.blocks.items.images.image,sections.blocks.items.images.link,sections.blocks.examples,sections.blocks.workItems.image,sections.blocks.workItems.categories,sections.blocks.privacyPolicy,sections.blocks.markerImage,sections.blocks.openingDays,sections.blocks.category',
    locale,
    publicationState: isDraft ? 'preview' : 'live',
    pagination: { page: 1, pageSize: 1 },
  })

  return pageRes.data[0] || null
}

const formatPublicationDate = (date: string | undefined, locale: string) => {
  if (!date) return null

  try {
    return new Date(date).toLocaleDateString(
      locale === 'fr' ? 'fr-FR' : 'en-US',
      {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }
    )
  } catch {
    return null
  }
}

export default async function BlogPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { page } = await searchParams

  const currentPage = Number(page || '1')
  const safePage =
    Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1

  const articleRes = await fetchBlogArticles({
    locale,
    isDraft: false,
    page: safePage,
    pageSize: PAGE_SIZE,
  })
  const blogPage = await fetchBlogLandingPage({
    locale,
    isDraft: false,
  })
  const blogSections = (blogPage?.sections || []).sort(
    (a, b) => (a.order || 0) - (b.order || 0)
  )

  const articles = articleRes.data
  const pagination = articleRes.meta.pagination
  const hasPreviousPage = Boolean(pagination && pagination.page > 1)
  const hasNextPage = Boolean(
    pagination && pagination.page < pagination.pageCount
  )

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-10">
        {!blogPage?.hideTitle ? (
          <h1 className="text-3xl font-bold tracking-tight">
            {blogPage?.title || (locale === 'fr' ? 'Blog' : 'Blog')}
          </h1>
        ) : null}
        {!blogPage ? (
          <p className="mt-2 text-neutral-600">
            {locale === 'fr'
              ? 'Conseils horlogers, histoires et nouveautes de la maison.'
              : 'Watchmaking insights, stories and latest house updates.'}
          </p>
        ) : null}
      </header>

      {blogSections.length > 0 ? (
        <div className="mb-12 space-y-8">
          {blogSections.map((section) => (
            <SectionGeneric
              key={section.id}
              identifier={section.identifier}
              title={section.hideTitle ? undefined : section.title}
              blocks={section.blocks as DynamicBlock[]}
              locale={locale}
              containerWidth={normalizeContainerWidth(section.containerWidth)}
              spacingTop={
                section.spacingTop as
                  | 'none'
                  | 'small'
                  | 'medium'
                  | 'large'
                  | undefined
              }
              spacingBottom={
                section.spacingBottom as
                  | 'none'
                  | 'small'
                  | 'medium'
                  | 'large'
                  | undefined
              }
            />
          ))}
        </div>
      ) : null}

      {articles.length === 0 ? (
        <p className="text-neutral-500">
          {locale === 'fr'
            ? 'Aucun article publie pour le moment.'
            : 'No published articles yet.'}
        </p>
      ) : (
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => {
            const image = article.coverImage
            const imageUrl = image?.url
              ? image.url.startsWith('http')
                ? image.url
                : `${process.env.NEXT_PUBLIC_STRAPI_URL}${image.url}`
              : null
            const formattedDate = formatPublicationDate(
              article.publicationDate || article.createdAt,
              locale
            )

            return (
              <li key={article.id}>
                <Link
                  href={`/${locale}/blog/${article.slug}`}
                  className="group block"
                >
                  <article className="h-full overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-shadow hover:shadow-md">
                    <div className="relative aspect-[4/3] w-full bg-neutral-100">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={
                            image?.alternativeText ||
                            article.title ||
                            'Blog article'
                          }
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                      ) : null}
                    </div>

                    <div className="space-y-3 p-5">
                      {formattedDate ? (
                        <p className="text-xs uppercase tracking-wide text-neutral-500">
                          {formattedDate}
                        </p>
                      ) : null}

                      <h2 className="text-lg font-semibold leading-snug group-hover:underline">
                        {article.title}
                      </h2>

                      {article.excerpt ? (
                        <p className="line-clamp-3 text-sm text-neutral-600">
                          {article.excerpt}
                        </p>
                      ) : null}
                    </div>
                  </article>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {(hasPreviousPage || hasNextPage) && pagination ? (
        <nav
          className="mt-10 flex items-center justify-between"
          aria-label={
            locale === 'fr' ? 'Pagination du blog' : 'Blog pagination'
          }
        >
          {hasPreviousPage ? (
            <Link
              href={`/${locale}/blog?page=${pagination.page - 1}`}
              className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
            >
              {locale === 'fr' ? 'Page precedente' : 'Previous page'}
            </Link>
          ) : (
            <span />
          )}

          <span className="text-sm text-neutral-500">
            {locale === 'fr'
              ? `Page ${pagination.page} sur ${pagination.pageCount}`
              : `Page ${pagination.page} of ${pagination.pageCount}`}
          </span>

          {hasNextPage ? (
            <Link
              href={`/${locale}/blog?page=${pagination.page + 1}`}
              className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
            >
              {locale === 'fr' ? 'Page suivante' : 'Next page'}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </main>
  )
}
