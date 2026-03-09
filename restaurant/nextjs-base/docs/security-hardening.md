# Security Hardening (Restaurant Variant)

This document explains security hardening for public reservation APIs in the restaurant variant.

## Covered endpoint

- `src/app/api/reservation/route.ts`

## Protections enabled

### 1. Origin and referer validation

Utility: `src/lib/public-api-security.ts`

- Allows same-origin requests automatically
- Allows additional origins from `PUBLIC_API_ALLOWED_ORIGINS`
- Rejects unauthorized requests with `403`

### 2. Rate limiting

Utility: `src/lib/rate-limit.ts`

- Uses Upstash Redis REST if configured
- Falls back to in-memory limiter if Upstash is unavailable
- On throttling, returns `429` with:
  - `Retry-After`
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Source`

Current reservation defaults:
- limit: `3`
- window: `10 minutes`

## Environment variables

Set in Vercel `Project -> Settings -> Environment Variables`:

```env
UPSTASH_REDIS_REST_URL=https://<your-db-endpoint>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<your-upstash-rest-token>
PUBLIC_API_ALLOWED_ORIGINS=https://votre-domaine.com,https://www.votre-domaine.com
```

Notes:
- Upstash variables are optional but recommended for production reliability.
- If Upstash is missing, `X-RateLimit-Source` will show `memory`.

## Verification checklist

1. Valid reservation request from allowed origin -> normal response (`200` or validation `400`).
2. Request from unauthorized origin -> `403`.
3. Burst requests -> `429` with rate-limit headers.
4. In production, confirm `X-RateLimit-Source: upstash`.
