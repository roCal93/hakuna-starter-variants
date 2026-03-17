/**
 * product controller
 */

import { factories } from '@strapi/strapi';
type CreateCoreControllerArg = Parameters<typeof factories.createCoreController>[0];

export default factories.createCoreController('api::product.product' as CreateCoreControllerArg);
