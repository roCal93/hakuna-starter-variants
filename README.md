# Starter Variants

Ce dossier contient les overlays métier appliqués **après** la copie du starter de base (`hakuna-mataweb-starter`).

## Structure

- `restaurant/`
  - `nextjs-base/` : routes API réservation/admin, pages admin, helpers de sécurité/réservation, `.env.example`
  - `strapi-base/` : content-types `reservation`, `blocked-slot`, `reservation-config`

## Règle d'architecture

- Le starter de base reste générique.
- Les fonctionnalités verticales métier sont ajoutées via overlay de variant.
- Les blocks restent gérés par `block-library` et les presets, jamais par le starter.
