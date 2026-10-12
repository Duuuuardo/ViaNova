import { Elysia, t } from 'elysia'
import { cors } from '@elysiajs/cors'
import logixlysia from 'logixlysia'
import { timingSafeEqual } from 'node:crypto'
import { introspectToken } from '@vianova/oidc'
import { configStore } from './store'
import { rateLimit } from './rate-limit'

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.trim().length === 0) {
    console.error(`[config-server] Environment variable ${name} is required`)
    process.exit(1)
  }
  return value
}

function getRequiredSecret(name: string): string {
  const value = process.env[name]
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required secret: ${name}`)
  }
  if (value.length < 16) {
    throw new Error(`Secret ${name} is too short (min 16 characters)`)
  }
  return value
}

function verifySecret(provided: string | undefined | null, expected: string): boolean {
  if (!provided) return false
  const providedBuf = Buffer.from(provided)
  const expectedBuf = Buffer.from(expected)
  if (providedBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(providedBuf, expectedBuf)
}

const INTERNAL_SECRET = getRequiredSecret('VIANOVA_INTERNAL_SECRET')

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
  return verifySecret(headers.get('x-internal-secret'), INTERNAL_SECRET)
}

const ALLOWED_PRODUCTS = ['vianova', 'naia', 'campaigns', 'crm'] as const

function getCorsOriginHandler(): string | string[] | RegExp | ((request: Request) => boolean) {
  if (process.env.NODE_ENV !== 'production') {
    const regex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
    return (request: Request) => regex.test(request.headers.get('origin') ?? '')
  }

  const configured = process.env.CORS_ALLOWED_ORIGINS
  if (configured) {
    try {
      const list = JSON.parse(configured) as string[]
      if (!Array.isArray(list) || list.some((o) => typeof o !== 'string')) {
        throw new Error('CORS_ALLOWED_ORIGINS must be a JSON array of strings')
      }
      return list
    } catch {
      console.error('[config-server] CORS_ALLOWED_ORIGINS is not a valid JSON array')
      process.exit(1)
    }
  }

  return [getRequiredEnv('VIANOVA_WEB_URL')]
}

const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000)
const rateLimitMax = Number(process.env.RATE_LIMIT_MAX ?? 1_000)

const app = new Elysia()
  .use(rateLimit({ windowMs: rateLimitWindowMs, max: rateLimitMax }))
  .use(
    cors({
      origin: getCorsOriginHandler(),
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
