/**
 * product-category router
 */

import { factories } from '@strapi/strapi';
type CreateCoreRouterArg = Parameters<typeof factories.createCoreRouter>[0];

export default factories.createCoreRouter('api::product-category.product-category' as CreateCoreRouterArg);
