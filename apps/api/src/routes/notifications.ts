import { Elysia, t } from 'elysia'
import { desc, eq, and, isNull, count } from 'drizzle-orm'
import { db, notifications, users } from '@vianova/db'
import { authPlugin } from '../plugins/auth'
import { createNotification, notifyUser, type NotificationType } from '../lib/notifications'
import { sendProductNotificationEmail } from '../lib/email'
import { introspectToken } from '@vianova/oidc'
import { getRequiredSecret, verifySecret } from '../lib/secrets'

const PAGE_SIZE = 50

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

export const notificationRoutes = new Elysia()
  .use(authPlugin)

  // Lista de notificações da conta logada.
  .get(
    '/notifications',
    async ({ session, query, set }) => {
      if (!session) {
        set.status = 401
        return { message: 'Não autenticado.' }
      }

      const page = Math.max(1, Number(query.page ?? 1))
      const offset = (page - 1) * PAGE_SIZE
      const productSlug = query.product_slug

      const listWhere = productSlug
        ? and(eq(notifications.userId, session.userId), eq(notifications.sourceProductSlug, productSlug))
        : eq(notifications.userId, session.userId)
      const unreadWhere = productSlug
        ? and(eq(notifications.userId, session.userId), isNull(notifications.readAt), eq(notifications.sourceProductSlug, productSlug))
        : and(eq(notifications.userId, session.userId), isNull(notifications.readAt))

      const [unreadRow] = await db
        .select({ value: count() })
        .from(notifications)
        .where(unreadWhere)

      const rows = await db
        .select()
        .from(notifications)
        .where(listWhere)
        .orderBy(desc(notifications.createdAt))
        .limit(PAGE_SIZE)
        .offset(offset)

      return {
        notifications: rows,
        unreadCount: unreadRow?.value ?? 0,
        hasMore: rows.length === PAGE_SIZE,
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.Numeric()),
        product_slug: t.Optional(t.String()),
      }),
    },
  )

  // Marca uma notificação como lida.
  .post(
    '/notifications/:id/read',
    async ({ session, params, set }) => {
      if (!session) {
        set.status = 401
        return { message: 'Não autenticado.' }
      }

      const [updated] = await db
        .update(notifications)
        .set({ readAt: new Date(), updatedAt: new Date() })
        .where(and(eq(notifications.id, params.id), eq(notifications.userId, session.userId)))
        .returning({ id: notifications.id })

      if (!updated) {
        set.status = 404
        return { message: 'Notificação não encontrada.' }
      }

      return { read: true as const }
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // Marca todas as notificações como lidas.
  .post('/notifications/read-all', async ({ session, set }) => {
    if (!session) {
      set.status = 401
      return { message: 'Não autenticado.' }
    }

    const rows = await db
      .update(notifications)
      .set({ readAt: new Date(), updatedAt: new Date() })
      .where(and(eq(notifications.userId, session.userId), isNull(notifications.readAt)))
      .returning({ id: notifications.id })

    return { marked: rows.length }
  })

  // Contagem rápida de não lidas (para o badge do header).
  .get('/notifications/unread-count', async ({ session, set }) => {
    if (!session) {
      set.status = 401
      return { message: 'Não autenticado.' }
    }

    const [row] = await db
      .select({ value: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, session.userId), isNull(notifications.readAt)))

    return { count: row?.value ?? 0 }
  })

  // Endpoint service-to-service: produtos criam notificações na conta Vianova.
  // Aceita token de serviço com scope `service:notifications:write` ou o
  // segredo interno compartilhado (`x-internal-secret`), conforme o padrão
  // usado em /internal/billing/ensure-free-subscription.
  // Opcionalmente envia email (send_email) — o Vianova usa suas próprias
  // preferências de usuário para decidir se dispara o SMTP.
  .post(
    '/internal/notifications',
    async ({ request, body, set }) => {
      const authHeader = request.headers.get('authorization') ?? undefined
      const service = await verifyServiceToken(authHeader, 'service:notifications:write')
      const viaSecret = verifyInternalSecret(request.headers)
      if (!service && !viaSecret) {
        set.status = 401
        return { message: 'Não autorizado.' }
      }
      const sourceProductSlug = service?.productSlug ?? (body.product_slug ?? 'unknown')

      const [user] = await db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, body.user_id))
        .limit(1)

      if (!user) {
        set.status = 404
        return { message: 'Usuário não encontrado.' }
      }

      const productName = sourceProductSlug === 'naia' ? 'Naia Campanhas' : sourceProductSlug
      const brand = body.brand === 'naia' ? 'naia' : 'vianova'

      const notification = await notifyUser({
        userId: user.id,
        type: body.type as NotificationType,
        source: sourceProductSlug,
        sourceProductSlug,
        sourceWorkspaceId: body.workspace_id ?? null,
        sourceWorkspaceName: body.workspace_name ?? null,
        title: body.title,
        body: body.body ?? undefined,
        actionUrl: body.action_url ?? undefined,
        actionLabel: body.action_label ?? undefined,
        metadata: body.metadata ?? {},
        ...(body.send_email
          ? {
              email: {
                to: user.email,
                name: user.name,
                send: (email: string, name: string) =>
                  sendProductNotificationEmail(
                    email,
                    name,
                    productName,
                    body.title,
                    body.body ?? '',
                    body.action_url,
                    body.action_label,
                    brand,
                  ),
              },
            }
          : {}),
      })

      return { id: notification.id }
    },
    {
      body: t.Object({
        user_id: t.String(),
        type: t.Union([t.Literal('billing'), t.Literal('security'), t.Literal('product'), t.Literal('marketing')]),
        title: t.String(),
        body: t.Optional(t.String()),
        workspace_id: t.Optional(t.String()),
        workspace_name: t.Optional(t.String()),
        action_url: t.Optional(t.String()),
        action_label: t.Optional(t.String()),
        metadata: t.Optional(t.Record(t.String(), t.Unknown())),
        product_slug: t.Optional(t.String()),
        send_email: t.Optional(t.Boolean()),
        brand: t.Optional(t.Union([t.Literal('vianova'), t.Literal('naia')])),
      }),
    },
  )
