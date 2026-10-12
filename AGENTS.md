# Vianova: Agent Instructions

Account, identity, billing, and shared infrastructure hub of the NovaPlatform ecosystem.

## Scope

- `apps/api`: Elysia API. Auth, OIDC provider, Stripe billing, organizations, avatars/MinIO, `/internal/*` service routes.
- `apps/web`: TanStack Start. Account app, login, 2FA, profile, billing portal, product switcher.
- `apps/landing`: public landing site for `vianova.software`.
- `apps/email-worker`: BullMQ email worker for the ecosystem.
- `apps/config-server`: centralized config server per product and environment.
- `packages/config`: Tailwind theme (`via-500 #C466FF`).
- `packages/db`, `packages/oidc`, `packages/client`, `packages/config-client`.

## Rules

1. Never use manual `fetch` in the frontend. Always go through the Eden Treaty client in `@vianova/client`.
2. Elysia routes declare schemas for body and query params. No untyped input.
3. Stripe exists only in this repo. No other repository integrates Stripe directly.
4. MinIO exists only here. Products receive avatar URLs via the `picture` claim.
5. Service tokens are scoped and short-lived. Valid scopes are defined in `apps/api/src/routes/internal.ts`.
6. The landing page and marketing surfaces never expose internal implementation details (OIDC, JWT, stack).
7. Database changes go through Drizzle migrations. Never edit generated SQL files by hand.

## Verification

- `bun run typecheck`
- `bun test`
- `bun run build`
- `bun audit`
