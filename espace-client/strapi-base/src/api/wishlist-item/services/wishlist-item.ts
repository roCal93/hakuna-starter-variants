/**
 * wishlist-item service
 */

import { factories } from '@strapi/strapi'
type CreateCoreServiceArg = Parameters<typeof factories.createCoreService>[0]

export default factories.createCoreService('api::wishlist-item.wishlist-item' as CreateCoreServiceArg)
