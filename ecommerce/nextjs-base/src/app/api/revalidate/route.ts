import { revalidatePath, revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    body = {}
  }

  const configuredSecret = process.env.REVALIDATE_SECRET
  if (!configuredSecret) {
    return NextResponse.json(
      { message: 'REVALIDATE_SECRET is not configured' },
      { status: 503 }
    )
  }

  const secret = request.headers.get('x-webhook-secret')
  if (!secret || secret !== configuredSecret) {
    return NextResponse.json({ message: 'Invalid secret' }, { status: 401 })
  }

  try {
    revalidateTag('strapi-pages', {})
    revalidatePath('/', 'layout')
    revalidatePath('/[locale]', 'layout')

    if (body.model === 'product') {
      revalidateTag('products', {})
      revalidatePath('/[locale]/boutique', 'page')
      const entry =
        body.entry && typeof body.entry === 'object'
          ? (body.entry as Record<string, unknown>)
          : null
      const slug = typeof entry?.slug === 'string' ? entry.slug : null
      const locale = typeof entry?.locale === 'string' ? entry.locale : 'fr'
      if (slug) {
        revalidatePath(`/${locale}/boutique/${slug}`)
      }
    }

    if (body.model === 'page') {
      const entry =
        body.entry && typeof body.entry === 'object'
          ? (body.entry as Record<string, unknown>)
          : null
      const slug = typeof entry?.slug === 'string' ? entry.slug : null
      const locale = typeof entry?.locale === 'string' ? entry.locale : 'fr'
      if (slug) {
        revalidatePath(`/${locale}/${slug}`)
        if (slug === 'home') {
          revalidatePath(`/${locale}`)
        }
      }
    }

    console.log('Revalidation triggered for Strapi content change:', body)

    return NextResponse.json({ revalidated: true, now: Date.now() })
  } catch (err) {
    console.error('Error during revalidation:', err)
    return NextResponse.json({ message: 'Error revalidating' }, { status: 500 })
  }
}
