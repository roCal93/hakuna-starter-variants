import { factories } from "@strapi/strapi";
type CreateCoreRouterArg = Parameters<typeof factories.createCoreRouter>[0];

export default factories.createCoreRouter(
  "api::product-record.product-record" as CreateCoreRouterArg
);
