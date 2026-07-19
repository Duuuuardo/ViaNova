import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import logixlysia from 'logixlysia'
import { errorSanitizerPlugin } from './plugins/error-sanitizer'
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
import { loadProductConfig, getConfigValue, type ConfigValue } from './lib/config'

async function bootstrap() {
  await loadProductConfig()

  const corsOrigin =
    process.env.NODE_ENV !== 'production'
      ? /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
      : getConfigValue<string>('app.url', process.env.VIANOVA_WEB_URL ?? 'http://localhost:3000')

  const app = new Elysia()
    .use(errorSanitizerPlugin)
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
      }),
    )
    .use(
      logixlysia({
        config: {
          service: 'vianova-api',
          showStartupMessage: true,
          startupMessageFormat: 'banner',
          showContextTree: true,
          contextDepth: 2,
          slowThreshold: 500,
          verySlowThreshold: 1000,
          timestamp: {
            translateTime: 'yyyy-mm-dd HH:MM:ss.SSS',
          },
          ip: true,
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
    .get('/health', () => ({ status: 'ok', service: 'vianova-api' }))
    .get('/config', () => ({ config: getConfigValue<Record<string, ConfigValue>>('config', {}) }))
    .listen(process.env.PORT ?? 5000)

  // Worker in-process no Milestone 1 (sync de entitlements + revogação de sessão).
  startWorker()

  console.log(`vianova-api rodando na porta ${app.server?.port}`)

  return app
}

const appPromise = bootstrap()

export type App = Awaited<typeof appPromise>
export default appPromise
