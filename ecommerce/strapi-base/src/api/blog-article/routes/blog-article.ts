/**
 * blog-article router
 */

import { factories } from '@strapi/strapi';
type CreateCoreRouterArg = Parameters<typeof factories.createCoreRouter>[0];

export default factories.createCoreRouter('api::blog-article.blog-article' as CreateCoreRouterArg);
