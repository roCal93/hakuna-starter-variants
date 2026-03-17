/**
 * product router
 */

import { factories } from '@strapi/strapi';
type CreateCoreRouterArg = Parameters<typeof factories.createCoreRouter>[0];

export default factories.createCoreRouter('api::product.product' as CreateCoreRouterArg);
