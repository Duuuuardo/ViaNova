import { Elysia, t } from 'elysia'
import { db, productCatalog, featureFlags } from '@vianova/db'
import { eq, and, or } from 'drizzle-orm'
import { signServiceToken, introspectToken } from '@vianova/oidc'
import { enqueueEmail } from '../lib/email-queue'
import { getRequiredSecret, verifySecret } from '../lib/secrets'

const ALLOWED_SCOPES = [
  'service:entitlements:write',
  'service:sessions:revoke',
  'service:notifications:write',
  'service:email:send',
  'service:config:read',
  'service:feature-flags:read',
] as const

async function verifyServiceToken(
  authHeader: string | undefined,
  requiredScope: string,
): Promise<{ productSlug: string } | null> {
  if (!authHeader) return null
  const token = authHeader.replace(/^Bearer /, '')
  const introspection = await introspectToken(token)
  if (!introspection.active) return null
  if (introspection.scope !== requiredScope) return null
  const aud = introspection.aud
  const productSlug = Array.isArray(aud) ? aud[0] : aud
  if (!productSlug) return null
  return { productSlug }
}

const INTERNAL_SECRET = getRequiredSecret('VIANOVA_INTERNAL_SECRET')

function verifyInternalSecret(headers: Headers): boolean {
  return verifySecret(headers.get('x-internal-secret'), INTERNAL_SECRET)
}

export const internalRoutes = new Elysia({ prefix: '/internal' })

  .post(
    '/service-token',
    async ({ body, headers, set }) => {
      const adminSecret = getRequiredSecret('INTERNAL_ADMIN_SECRET')
      const provided = headers.authorization?.replace(/^Bearer /, '')

      if (!verifySecret(provided, adminSecret)) {
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

  .post(
    '/email/enqueue',
    async ({ request, body, set }) => {
      const authHeader = request.headers.get('authorization') ?? undefined
      const service = await verifyServiceToken(authHeader, 'service:email:send')
      const viaSecret = verifyInternalSecret(request.headers)
      if (!service && !viaSecret) {
        set.status = 401
        return { message: 'Não autorizado.' }
      }

      await enqueueEmail({
        type: 'email:send',
        to: body.to,
        subject: body.subject,
        html: body.html,
        brand: body.brand,
        from: body.from,
        replyTo: body.reply_to,
        metadata: {
          sourceProduct: service?.productSlug ?? body.product_slug ?? 'unknown',
          sourceWorkspaceId: body.workspace_id,
        },
      })

      return { enqueued: true as const }
    },
    {
      body: t.Object({
        to: t.String({ format: 'email' }),
        subject: t.String(),
        html: t.String(),
        brand: t.Union([t.Literal('vianova'), t.Literal('naia'), t.Literal('crm')]),
        from: t.Optional(t.String()),
        reply_to: t.Optional(t.String()),
        product_slug: t.Optional(t.String()),
        workspace_id: t.Optional(t.String()),
      }),
    },
  )

  .get(
    '/feature-flags',
    async ({ request, query, set }) => {
      const authHeader = request.headers.get('authorization') ?? undefined
      const service = await verifyServiceToken(authHeader, 'service:feature-flags:read')
      const viaSecret = verifyInternalSecret(request.headers)
      if (!service && !viaSecret) {
        set.status = 401
        return { message: 'Não autorizado.' }
      }

      const productSlug = service?.productSlug ?? query.product_slug ?? 'global'
      const flags = await db
        .select({
          key: featureFlags.key,
          scope: featureFlags.scope,
          value: featureFlags.value,
        })
        .from(featureFlags)
        .where(
          and(
            eq(featureFlags.enabled, true),
            or(eq(featureFlags.scope, 'global'), eq(featureFlags.scope, `product:${productSlug}`)),
          ),
        )

      return {
        product_slug: productSlug,
        flags: Object.fromEntries(flags.map((f) => [f.key, f.value])),
      }
    },
    {
      query: t.Object({
        product_slug: t.Optional(t.String()),
      }),
    },
  )
