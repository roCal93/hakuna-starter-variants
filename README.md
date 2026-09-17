# Starter Variants

Ce dossier contient les overlays métier appliqués **après** la copie du starter de base (`hakuna-mataweb-starter`).

Les features migrées possèdent un `feature.json` à leur racine. Il décrit leur nom,
version, dépendances entre features et dépendances npm. La CLI découvre ces manifests,
résout les dépendances puis applique les overlays dans l'ordre requis.

## Structure

- Les features déclaratives possèdent un `feature.json` et ne fournissent plus de `.env.example` complet.
- `reservation/` : routes API réservation/admin et content-types `reservation`, `blocked-slot`, `reservation-config`.
- `restaurant/` : fragment legacy conservé pour référence, non utilisé par la CLI.

## Règle d'architecture


En résumé : le starter fournit le core, `block-library` fournit les blocks, et
`hakuna-starter-variants` fournit les features déclaratives. Les features migrées
 actuellement sont `reservation`, `ecommerce`, `espace-client`, `blog`, `photo-gallery`
 et `wedding-rsvp`. Le dossier `restaurant` est conservé comme legacy : il s'agit
 d'un ancien fragment d'admin partiellement doublonné par `reservation`, sans
 content-types Strapi ni référence active dans la CLI.

Un `feature.json` peut déclarer `packageDependencies`, `env` et des variables
conditionnelles dans `options.<option>.env`. La CLI agrège ces déclarations avec
`hakuna-mataweb-starter/env.json`, valide les conflits, puis génère les
`.env.example` finaux avant d'initialiser `.env.local` et `.env`.
