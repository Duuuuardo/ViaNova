import { Elysia, t } from 'elysia'
import { cors } from '@elysiajs/cors'
import logixlysia from 'logixlysia'
import { introspectToken } from '@vianova/oidc'
import { configStore } from './store'

const INTERNAL_SECRET = process.env.VIANOVA_INTERNAL_SECRET ?? 'vianova-internal-secret'

async function verifyServiceToken(
  authHeader: string | undefined,
): Promise<{ productSlug: string; scope: string } | null> {
  if (!authHeader) return null
  const token = authHeader.replace(/^Bearer /, '')
  const introspection = await introspectToken(token)
  if (!introspection.active) return null
  const scope = introspection.scope
  if (scope !== 'service:config:read') return null
  const aud = introspection.aud
  const productSlug = Array.isArray(aud) ? aud[0] : aud
  if (!productSlug) return null
  return { productSlug, scope }
}

function verifyInternalSecret(headers: Headers): boolean {
  return headers.get('x-internal-secret') === INTERNAL_SECRET
}

const ALLOWED_PRODUCTS = ['vianova', 'naia', 'campaigns', 'crm'] as const

const app = new Elysia()
  .use(
    cors({
      origin:
        process.env.NODE_ENV !== 'production'
          ? /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
          : (process.env.VIANOVA_WEB_URL ?? 'http://localhost:3000'),
      credentials: true,
    }),
  )
  .use(
    logixlysia({
      config: {
        service: 'vianova-config-server',
        showStartupMessage: true,
        startupMessageFormat: 'banner',
        showContextTree: false,
        contextDepth: 1,
        slowThreshold: 100,
        verySlowThreshold: 300,
        timestamp: {
          translateTime: 'yyyy-mm-dd HH:MM:ss.SSS',
        },
        ip: true,
      },
    }),
  )
  .get(
    '/config/:product/:environment',
    async ({ params, request, set }) => {
      const authHeader = request.headers.get('authorization') ?? undefined
      const service = await verifyServiceToken(authHeader)
      const viaSecret = verifyInternalSecret(request.headers)

      if (!service && !viaSecret) {
        set.status = 401
        return { message: 'Não autorizado.' }
      }

      if (service && service.productSlug !== params.product) {
        set.status = 403
        return { message: 'Token não autorizado para este produto.' }
      }

      const config = await configStore.load(params.product, params.environment)
      return { product: params.product, environment: params.environment, config }
    },
    {
      params: t.Object({
        product: t.Union([
          t.Literal('vianova'),
          t.Literal('naia'),
          t.Literal('campaigns'),
          t.Literal('crm'),
        ]),
        environment: t.Union([t.Literal('development'), t.Literal('staging'), t.Literal('production')]),
      }),
    },
  )
  .get('/health', () => ({ status: 'ok', service: 'vianova-config-server' }))
  .listen(process.env.PORT ?? 5100)

configStore.startWatching().catch((err) => {
  console.error('[config-server] erro no watcher:', err)
})

console.log(`vianova-config-server rodando na porta ${app.server?.port}`)

export type App = typeof app
export default app
