# Vianova

Hub de conta, identidade e billing do ecossistema (`vianova.software`). É o "Atlassian ID" da casa: conta única, 2FA, Organização, catálogo de produtos, portal de billing (Stripe vive **exclusivamente** aqui) e Identity Provider OIDC para os produtos (Naia, e futuros).

Specs completas vivem no repo NovaPlatform: `docs/architecture.md`, `docs/vianova-business-rules.md`, `docs/vianova-stack.md`.

## Estrutura

| Pacote | Responsabilidade |
|---|---|
| `apps/api` | Elysia (porta 5000) — auth, 2FA, Organização, catálogo, OIDC provider, Stripe, service tokens |
| `apps/web` | TanStack Start (porta 3000) — login, cadastro, 2FA, perfil, Organização, portal de billing, product switcher |
| `packages/db` | Drizzle + postgres — banco `vianova` |
| `packages/oidc` | Assinatura/verificação de JWT (`jose`), JWKS, introspection, service tokens |
| `packages/client` | Eden Treaty client do `apps/api` |

## Rodando em dev

```bash
docker compose up -d        # postgres (5434) + redis (6380)
cp .env.example .env
bun install
bun run db:migrate
bun run db:seed             # catálogo de produtos (naia) + planos
bun run dev                 # api (5000) + web (3000)
```

Cliente OIDC de teste (simula um produto trocando código por JWT):

```bash
bun scripts/mock-oidc-client.ts   # sobe em http://localhost:9999
```

## Contratos públicos (não quebrar sem coordenar)

- `GET /oidc/authorize`, `POST /oidc/token`, `POST /oidc/introspect`, `GET /.well-known/jwks.json`
- `POST /internal/service-token` — emissão de token de serviço escopado (Vianova → produto)
- Vianova → produto: `POST {product.api_url}/internal/entitlements` com token `service:entitlements:write`
