import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
  pathnames: {
    "/boutique": {
      fr: "/boutique",
      en: "/shop",
    },
    "/boutique/[slug]": {
      fr: "/boutique/[slug]",
      en: "/shop/[slug]",
    },
    "/panier": {
      fr: "/panier",
      en: "/cart",
    },
    "/checkout/success": "/checkout/success",
    "/checkout/cancel": "/checkout/cancel",
    "/blog": {
      fr: "/blog",
      en: "/blog",
    },
    "/blog/[slug]": {
      fr: "/blog/[slug]",
      en: "/blog/[slug]",
    },
  },
});
