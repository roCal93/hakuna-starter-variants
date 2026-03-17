/**
 * product service
 */

import { factories } from '@strapi/strapi';
type CreateCoreServiceArg = Parameters<typeof factories.createCoreService>[0];

export default factories.createCoreService('api::product.product' as CreateCoreServiceArg);
