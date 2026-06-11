import { createStrapiClient } from '@/lib/strapi-client'
import type {
  Section,
  StrapiBlock,
  StrapiCollectionResponse,
  StrapiEntity,
  StrapiMedia,
} from '@/types/strapi'

export interface BlogCategory {
  name: string
  slug: string
}

export interface BlogArticle {
  title?: string
  slug: string
  excerpt?: string
  coverImage?: StrapiMedia
  publicationDate?: string
  authorName?: string
  featured?: boolean
  sections?: (Section & StrapiEntity)[]
  categories?: (BlogCategory & StrapiEntity)[]
  seoTitle?: string
  seoDescription?: StrapiBlock[] | string
  seoImage?: StrapiMedia
  noIndex?: boolean
  locale?: string
  localizations?: (BlogArticle & StrapiEntity)[]
  createdAt?: string
  updatedAt?: string
}

export type BlogArticleCollectionResponse =
  StrapiCollectionResponse<BlogArticle>

const BLOG_ARTICLE_POPULATE_WITH_SECTIONS =
  'coverImage,categories,seoImage,localizations,sections.blocks.cards.image,sections.blocks.image,sections.blocks.imageDesktop,sections.blocks.buttons.file,sections.blocks.items.images.image,sections.blocks.items.images.link,sections.blocks.examples,sections.blocks.workItems.image,sections.blocks.workItems.categories,sections.blocks.privacyPolicy,sections.blocks.markerImage,sections.blocks.openingDays,sections.blocks.category'

const createClient = (isDraft: boolean) => {
  const apiToken = isDraft
    ? process.env.STRAPI_PREVIEW_TOKEN || process.env.STRAPI_API_TOKEN
    : process.env.STRAPI_API_TOKEN

  return createStrapiClient({
    apiUrl: process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337',
    apiToken,
  })
}

export async function fetchBlogArticles({
  locale,
  isDraft = false,
  page = 1,
  pageSize = 9,
}: {
  locale: string
  isDraft?: boolean
  page?: number
  pageSize?: number
}): Promise<BlogArticleCollectionResponse> {
  const client = createClient(isDraft)

  return client.findMany<BlogArticle>('blog-articles', {
    fields: [
      'title',
      'slug',
      'excerpt',
      'publicationDate',
      'authorName',
      'featured',
      'seoTitle',
      'seoDescription',
      'noIndex',
      'locale',
      'createdAt',
      'updatedAt',
    ],
    populate: {
      coverImage: {
        fields: ['url', 'alternativeText', 'width', 'height', 'formats'],
      },
      categories: {
        fields: ['name', 'slug'],
      },
      seoImage: {
        fields: ['url', 'alternativeText', 'width', 'height', 'formats'],
      },
      localizations: {
        fields: ['slug', 'locale'],
      },
    },
    locale,
    publicationState: isDraft ? 'preview' : 'live',
    sort: ['publicationDate:desc', 'createdAt:desc'],
    pagination: {
      page,
      pageSize,
    },
  })
}

export async function fetchBlogArticleBySlug({
  slug,
  locale,
  isDraft = false,
}: {
  slug: string
  locale: string
  isDraft?: boolean
}): Promise<BlogArticle | null> {
  const client = createClient(isDraft)

  const res = await client.findMany<BlogArticle>('blog-articles', {
    filters: { slug: { $eq: slug } },
    fields: [
      'title',
      'slug',
      'excerpt',
      'publicationDate',
      'authorName',
      'featured',
      'seoTitle',
      'seoDescription',
      'noIndex',
      'locale',
      'createdAt',
      'updatedAt',
    ],
    populate: BLOG_ARTICLE_POPULATE_WITH_SECTIONS,
    locale,
    publicationState: isDraft ? 'preview' : 'live',
    pagination: { page: 1, pageSize: 1 },
  })

  return res.data[0] || null
}

export async function fetchBlogSitemapEntries(): Promise<
  Array<BlogArticle & StrapiEntity>
> {
  const client = createClient(false)
  const res = await client.findMany<BlogArticle>('blog-articles', {
    fields: ['slug', 'locale', 'noIndex'],
    populate: {
      localizations: {
        fields: ['slug', 'locale'],
      },
    },
    publicationState: 'live',
    pagination: {
      page: 1,
      pageSize: 1000,
    },
  })

  return res.data.filter((entry) => !entry.noIndex)
}
