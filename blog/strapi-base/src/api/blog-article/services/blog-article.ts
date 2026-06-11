/**
 * blog-article service
 */

import { factories } from '@strapi/strapi';
type CreateCoreServiceArg = Parameters<typeof factories.createCoreService>[0];

export default factories.createCoreService('api::blog-article.blog-article' as CreateCoreServiceArg);
