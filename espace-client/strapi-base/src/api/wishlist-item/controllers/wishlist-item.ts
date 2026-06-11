/**
 * wishlist-item controller
 * Ownership enforced: chaque client ne voit que ses propres favoris
 */

import { factories } from '@strapi/strapi'

type UID = 'api::wishlist-item.wishlist-item'
const MODEL_UID: UID = 'api::wishlist-item.wishlist-item'

export default factories.createCoreController(MODEL_UID, ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user as { id: number } | null
    if (!user) return ctx.unauthorized('Authentification requise')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entries = await (strapi.documents(MODEL_UID) as any).findMany({
      filters: { customer: { id: { $eq: user.id } } },
      populate: {
        product: {
          populate: ['images'],
        },
      },
    })

    return { data: entries, meta: {} }
  },

  async create(ctx) {
    const user = ctx.state.user as { id: number } | null
    if (!user) return ctx.unauthorized('Authentification requise')

    const body = ctx.request.body as { data?: { product?: string | number } }
    const productId = body?.data?.product
    if (!productId) return ctx.badRequest('product requis')

    // Check if already in wishlist
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = strapi.documents(MODEL_UID) as any
    const existing = await svc.findMany({
      filters: {
        customer: { id: { $eq: user.id } },
        product: { id: { $eq: productId } },
      },
    })

    if (existing.length > 0) {
      return { data: existing[0] }
    }

    const entry = await svc.create({
      data: { customer: user.id, product: productId },
      populate: { product: { populate: ['images'] } },
    })

    ctx.status = 201
    return { data: entry }
  },

  async delete(ctx) {
    const user = ctx.state.user as { id: number } | null
    if (!user) return ctx.unauthorized('Authentification requise')

    const { id } = ctx.params as { id: string }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = strapi.documents(MODEL_UID) as any
    const entry = await svc.findOne({
      documentId: id,
      populate: ['customer'],
    })

    if (!entry) return ctx.notFound('Favori introuvable')

    const customerId = (entry.customer as { id: number } | null)?.id
    if (customerId !== user.id) return ctx.forbidden('Accès refusé')

    await svc.delete({ documentId: id })

    ctx.status = 204
    return null
  },
}))
