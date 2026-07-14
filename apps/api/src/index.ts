import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { authPlugin } from './plugins/auth'
import { authRoutes } from './routes/auth'
import { organizationRoutes } from './routes/organizations'
import { catalogRoutes } from './routes/catalog'
import { oidcRoutes } from './routes/oidc'
import { internalRoutes } from './routes/internal'
import { billingRoutes } from './routes/billing'
import { startWorker } from './lib/queue'

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
  .use(authPlugin)
  .use(authRoutes)
  .use(organizationRoutes)
  .use(catalogRoutes)
  .use(oidcRoutes)
  .use(internalRoutes)
  .use(billingRoutes)
  .get('/health', () => ({ status: 'ok', service: 'vianova-api' }))
  .listen(process.env.PORT ?? 5000)

// Worker in-process no Milestone 1 (sync de entitlements + revogação de sessão).
startWorker()

console.log(`vianova-api rodando na porta ${app.server?.port}`)

export type App = typeof app
export default app
