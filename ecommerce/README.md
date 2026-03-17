# Variant E-commerce

Overlay e-commerce à appliquer par-dessus `hakuna-mataweb-starter` pour créer une boutique en ligne avec Stripe Checkout.

## Ce que ce variant ajoute

### Strapi (`strapi-base/`)
| Content-type | Description |
|---|---|
| `product` | Produit (nom, slug, prix, stock, images, catégorie, i18n) |
| `product-category` | Catégorie de produits (i18n) |
| `order` | Commande créée automatiquement après paiement Stripe |

**Composants partagés Strapi (`src/components/shop/`) :**
- `order-line-item` — ligne d'article dans une commande
- `shipping-address` — adresse de livraison

### Next.js (`nextjs-base/`)

**Pages :**
- `[locale]/boutique` — listing produits avec filtres catégories
- `[locale]/boutique/[slug]` — fiche produit
- `[locale]/panier` — page panier
- `[locale]/checkout/success` — confirmation de commande
- `[locale]/checkout/cancel` — paiement annulé

**API routes :**
- `POST /api/checkout/session` — crée une Stripe Checkout Session
- `POST /api/webhooks/stripe` — webhook Stripe → crée l'ordre dans Strapi

**Composants cart :**
- `CartContext` — état global du panier (React Context + useReducer + localStorage)
- `CartDrawer` — sidebar panier
- `CartButton` — icône header avec badge

**Lib :**
- `lib/stripe.ts` — init SDK Stripe serveur
- `lib/cart-storage.ts` — helpers localStorage
- `lib/currency.ts` — `formatPrice()`, `toCents()`
- `lib/webhook-validation.ts` — validation signature webhook

**i18n :** routage `[locale]` via `next-intl` (FR + EN), fichiers de traduction dans `messages/`

## Dépendances supplémentaires à installer

```bash
# Dans nextjs-base
pnpm add stripe @stripe/stripe-js next-intl
```

## Mise en route

### 1. Strapi

```bash
cd strapi-base && pnpm develop
```

Configurer les permissions publiques dans **Settings → Users & Permissions → Public** :
- `product` : `find`, `findOne`
- `product-category` : `find`, `findOne`

Créer un token API **read-only** et un token **full-access** (pour le webhook).

### 2. Next.js

Copier `.env.example` → `.env.local` et renseigner :
- `STRAPI_API_TOKEN` — token read-only Strapi
- `STRAPI_WRITE_API_TOKEN` — token full-access Strapi
- `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — dashboard Stripe (mode test)
- `STRIPE_WEBHOOK_SECRET` — voir ci-dessous

### 3. Webhook Stripe en développement

```bash
# Installer la Stripe CLI si besoin
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Écouter et forwarder vers Next.js
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copier le `whsec_...` affiché dans `STRIPE_WEBHOOK_SECRET`.

### 4. Tester un paiement

1. Ajouter un produit dans Strapi
2. Aller sur `/boutique`
3. Ajouter au panier → checkout
4. Carte test : `4242 4242 4242 4242` (n'importe quelle date future, CVC 3 chiffres)
5. Vérifier que la commande apparaît dans Strapi admin avec `status: paid`

## Architecture de décision

| Choix | Raison |
|---|---|
| **Stripe Checkout hosted** | Aucun scope PCI, robuste, supporte Apple Pay/Google Pay d'office |
| **Cart localStorage** | Pas de session serveur, persistant entre visites, fonctionne sans compte |
| **Comptes optionnels** | MVP guest checkout, espace compte via Strapi users-permissions en phase 2 |
| **Orders dans Strapi + Stripe** | Reporting interne Strapi + réconciliation Stripe dashboard |
| **next-intl** | Standard App Router, routing `[locale]`, messages typés |
