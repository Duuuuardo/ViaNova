# Vianova — Instruções para o Agente

> Repo do hub de conta, identidade, billing e infra compartilhada do ecossistema NovaPlatform.
> Leia `docs/vianova-business-rules.md`, `docs/vianova-stack.md` e `docs/vianova-design.md` antes de qualquer decisão de produto, código ou UI.

## Escopo deste repo

- `apps/api` — Elysia: auth, OIDC provider, billing/Stripe, organização, avatares/MinIO, rotas `/internal/*`.
- `apps/web` — TanStack Start: app de conta, login, 2FA, perfil, billing portal, product switcher.
- `apps/landing` — landing pública `vianova.software`.
- `apps/email-worker` — worker BullMQ de envio de email para todo o ecossistema.
- `apps/config-server` — config server centralizado por produto/ambiente.
- `packages/config` — tema Tailwind roxo (`via-500 #C466FF`).
- `packages/db`, `packages/oidc`, `packages/client`, `packages/config-client`.

## Regras de ouro

1. **Toda decisão de produto/feature/modelo**: invocar `vianova-rules`.
2. **Antes de escrever código**: invocar `vianova-stack`.
3. **Antes de tocar em UI**: invocar `frontend-design` + ler `docs/vianova-design.md`.
4. **Toda entrega de UI**: passar por `emil-design-eng`.
5. **Nunca usar `fetch` manual no frontend** — sempre Eden Treaty via `@vianova/client`.
6. **Rotas Elysia são tipadas na definição** — nenhum body/query param sem schema.
7. **Stripe só existe aqui** — nenhum outro repo integra Stripe diretamente.
8. **MinIO só aqui** — produtos recebem URL de avatar pelo claim `picture`.
9. **Service tokens são escopados e curtos** — escopos válidos em `apps/api/src/routes/internal.ts`.
10. **Landing/marketing nunca expõe implementação interna** (OIDC, JWT, stack, "inspirado em X").

## Docs relacionadas

- `../docs/architecture.md`
- `../docs/vianova-business-rules.md`
- `../docs/vianova-stack.md`
- `../docs/vianova-design.md`
- `../docs/decisions/001-monorepos-vs-microrepos.md`
- `../docs/decisions/002-centralized-email.md`
- `../docs/decisions/003-centralized-config-server.md`
- `../docs/decisions/004-design-systems-per-brand.md`
