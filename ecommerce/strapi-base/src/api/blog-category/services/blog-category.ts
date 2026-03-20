/**
 * blog-category service
 */

import { factories } from '@strapi/strapi';
type CreateCoreServiceArg = Parameters<typeof factories.createCoreService>[0];

export default factories.createCoreService('api::blog-category.blog-category' as CreateCoreServiceArg);
