import { Elysia, t } from 'elysia'
import { db, productCatalog } from '@vianova/db'
import { eq } from 'drizzle-orm'
import { signServiceToken } from '@vianova/oidc'

const ALLOWED_SCOPES = ['service:entitlements:write', 'service:sessions:revoke', 'service:notifications:write'] as const

// Emissão de token de serviço escopado (Vianova → produto). Autenticado pelo
// segredo administrativo interno — nunca por JWT de usuário nem client secret
// de produto. Uso normal é interno (fila de sync); a rota existe para
// operação/testes e futuros processos separados do Vianova.
export const internalRoutes = new Elysia({ prefix: '/internal' })

  .post(
    '/service-token',
    async ({ body, headers, set }) => {
      const adminSecret = process.env.INTERNAL_ADMIN_SECRET
      const provided = headers.authorization?.replace(/^Bearer /, '')

      if (!adminSecret || provided !== adminSecret) {
        set.status = 401
        return { message: 'Não autorizado.' }
      }

      if (!ALLOWED_SCOPES.includes(body.scope as (typeof ALLOWED_SCOPES)[number])) {
        set.status = 400
        return { message: `Escopo inválido. Permitidos: ${ALLOWED_SCOPES.join(', ')}` }
      }

      const [product] = await db
        .select({ slug: productCatalog.slug })
        .from(productCatalog)
        .where(eq(productCatalog.slug, body.product_slug))
        .limit(1)

      if (!product) {
        set.status = 404
        return { message: 'Produto não encontrado no catálogo.' }
      }

      const { token, expiresIn } = await signServiceToken(body.product_slug, body.scope)

      return { token, token_type: 'Bearer' as const, expires_in: expiresIn }
    },
    {
      body: t.Object({
        product_slug: t.String(),
        scope: t.String(),
      }),
    },
  )
