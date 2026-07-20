import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import logixlysia from 'logixlysia'
import { errorSanitizerPlugin } from './plugins/error-sanitizer'
import { rateLimit } from './plugins/rate-limit'
import { authPlugin } from './plugins/auth'
import { authRoutes } from './routes/auth'
import { accountRoutes } from './routes/account'
import { organizationRoutes } from './routes/organizations'
import { catalogRoutes } from './routes/catalog'
import { oidcRoutes } from './routes/oidc'
import { internalRoutes } from './routes/internal'
import { billingRoutes } from './routes/billing'
import { filesRoutes } from './routes/files'
import { notificationRoutes } from './routes/notifications'
import { startWorker } from './lib/queue'
import { loadProductConfig } from './lib/config'
import { requireEnv, getTokenHashSalt, getCorsOriginHandler, isProduction } from './lib/env'

async function bootstrap() {
  // Secrets obrigatórios — fail-closed no bootstrap.
  requireEnv('VIANOVA_INTERNAL_SECRET')
  requireEnv('INTERNAL_ADMIN_SECRET')
  requireEnv('TOKEN_HASH_SALT')
  requireEnv('VIANOVA_API_URL')
  requireEnv('VIANOVA_WEB_URL')
  getTokenHashSalt()

  await loadProductConfig()

  const corsOrigin = getCorsOriginHandler()

  const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000)
  // Limite generoso para não atrapalhar navegação normal de SPA
  // (múltiplas abas, troca rápida pela sidebar). Ajustável via env.
  const rateLimitMax = Number(process.env.RATE_LIMIT_MAX ?? 1_000)

  const app = new Elysia()
    .use(errorSanitizerPlugin)
    .use(rateLimit({ windowMs: rateLimitWindowMs, max: rateLimitMax }))
    .use(
      cors({
        origin: corsOrigin,
        credentials: true,
      }),
    )
    .use(
      swagger({
        documentation: {
          info: {
            title: 'Vianova API',
            version: '0.0.1',
            description: 'Account, identity, billing and OIDC provider for the NovaPlatform ecosystem.',
          },
        },
        exclude: isProduction ? '*' : undefined,
      }),
    )
    .use(
      logixlysia({
        config: {
          service: 'vianova-api',
          showStartupMessage: true,
          startupMessageFormat: 'banner',
          showContextTree: !isProduction,
          contextDepth: isProduction ? 0 : 2,
          slowThreshold: 500,
          verySlowThreshold: 1000,
          timestamp: {
            translateTime: 'yyyy-mm-dd HH:MM:ss.SSS',
          },
          ip: !isProduction,
        },
      }),
    )
    .use(authPlugin)
    .use(authRoutes)
    .use(accountRoutes)
    .use(organizationRoutes)
    .use(catalogRoutes)
    .use(oidcRoutes)
    .use(internalRoutes)
    .use(billingRoutes)
    .use(filesRoutes)
    .use(notificationRoutes)
    .get('/health', () => ({ status: 'ok' }))
    .listen(process.env.PORT ?? 5000)

  // Worker in-process no Milestone 1 (sync de entitlements + revogação de sessão).
  startWorker()

  console.log(`vianova-api rodando na porta ${app.server?.port}`)

  return app
}

const appPromise = bootstrap()

export type App = Awaited<typeof appPromise>
export default appPromise
