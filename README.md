# Vianova

> **Status: open-sourced after shutdown.** Vianova ran in production at
> `vianova.software` powering account, billing, and identity for the products
> below. The services are no longer deployed — this repository is published
> as-is for reference and portfolio, and is not actively maintained.

Account, identity, and billing hub for a product ecosystem (`vianova.software`). It plays the "Atlassian ID" role: single account, 2FA, organizations, product catalog, billing portal, and an OIDC identity provider for the products (Naia and future ones). Stripe integration exists only in this repository.

## Structure

| Package | Responsibility |
|---|---|
| `apps/api` | Elysia (port 5000): auth, 2FA, organizations, catalog, OIDC provider, Stripe, service tokens |
| `apps/web` | TanStack Start (port 3000): login, registration, 2FA, profile, organizations, billing portal, product switcher |
| `apps/landing` | Public landing site |
| `apps/email-worker` | BullMQ worker that sends transactional email |
| `apps/config-server` | Centralized per-product, per-environment configuration server |
| `packages/db` | Drizzle + Postgres (`vianova` database), migrations, seed |
| `packages/oidc` | JWT signing/verification (`jose`), JWKS, introspection, service tokens |
| `packages/client` | Eden Treaty client for `apps/api` |

## Running in dev

```bash
docker compose up -d
cp .env.example .env
bun install
bun run db:migrate
bun run db:seed
bun run dev
```

Test OIDC client that simulates a product exchanging an authorization code for a JWT:

```bash
bun scripts/mock-oidc-client.ts
```

## Public contracts

Breaking these requires coordination with the products that consume them:

- `GET /oidc/authorize`, `POST /oidc/token`, `POST /oidc/introspect`, `GET /.well-known/jwks.json`
- `POST /internal/service-token`: issues a scoped service token (Vianova to product)
- Vianova calls products back at `POST {product.api_url}/internal/entitlements` with a `service:entitlements:write` token

## Security notes

- Service tokens are short-lived JWTs scoped to a single product audience and explicit scopes.
- OIDC user JWTs carry `sid` and are tied to the Vianova session, so logout and introspection can revoke access everywhere.
- File and avatar blobs live in MinIO; credentials stay server-side.
- Product-facing error responses never leak internal details; see `apps/api/src/plugins/error-sanitizer.ts`.
