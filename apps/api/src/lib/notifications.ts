import { eq, and, isNull, count, desc } from 'drizzle-orm'
import { db, users, notifications, type NewNotification, type Notification } from '@vianova/db'
import { generateId } from './crypto'

export type NotificationType = 'billing' | 'security' | 'product' | 'marketing'

interface NotifyOptions {
  userId: string
  type: NotificationType
  source?: string
  sourceProductSlug?: string | null
  sourceWorkspaceId?: string | null
  sourceWorkspaceName?: string | null
  title: string
  body?: string
  actionUrl?: string
  actionLabel?: string
  metadata?: Record<string, unknown>
  email?: {
    to: string
    name: string
    send: (email: string, name: string) => Promise<void>
    ignorePreference?: boolean
  }
}

const TYPE_TO_PREFERENCE: Record<NotificationType, keyof NonNullable<NonNullable<typeof users.$inferSelect.preferences>>> = {
  billing: 'billingAlerts',
  security: 'securityAlerts',
  product: 'billingAlerts',
  marketing: 'marketingEmails',
}

export async function createNotification(data: Omit<NewNotification, 'id' | 'createdAt' | 'updatedAt'>): Promise<Notification> {
  const id = generateId()
  const [notification] = await db
    .insert(notifications)
    .values({
      ...data,
      id,
      readAt: data.readAt ?? null,
      emailedAt: data.emailedAt ?? null,
      metadata: data.metadata ?? {},
    })
    .returning()
  return notification
}

function shouldEmail(user: typeof users.$inferSelect, type: NotificationType): boolean {
  const key = TYPE_TO_PREFERENCE[type]
  const prefs = user.preferences ?? {}
  return prefs[key] !== false
}

export async function notifyUser(options: NotifyOptions): Promise<Notification> {
  const notification = await createNotification({
    userId: options.userId,
    type: options.type,
    source: options.source ?? 'vianova',
    sourceProductSlug: options.sourceProductSlug ?? null,
    sourceWorkspaceId: options.sourceWorkspaceId ?? null,
    sourceWorkspaceName: options.sourceWorkspaceName ?? null,
    title: options.title,
    body: options.body ?? null,
    actionUrl: options.actionUrl ?? null,
    actionLabel: options.actionLabel ?? null,
    metadata: options.metadata ?? {},
  })

  if (options.email) {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, options.userId)).limit(1)
      if (user && (options.email.ignorePreference || shouldEmail(user, options.type))) {
        await options.email.send(options.email.to, options.email.name)
        await db
          .update(notifications)
          .set({ emailedAt: new Date(), updatedAt: new Date() })
          .where(eq(notifications.id, notification.id))
      }
    } catch (err) {
      console.error('[notifications:email] falha ao enviar email:', err)
    }
  }

  return notification
}

export async function getUnreadCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
  return row?.value ?? 0
}

export async function listNotifications(userId: string, limit = 50, offset = 0) {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset)
  return rows
}

export async function markAsRead(userId: string, notificationId: string): Promise<boolean> {
  const [updated] = await db
    .update(notifications)
    .set({ readAt: new Date(), updatedAt: new Date() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
    .returning({ id: notifications.id })
  return Boolean(updated)
}

export async function markAllAsRead(userId: string): Promise<number> {
  const rows = await db
    .update(notifications)
    .set({ readAt: new Date(), updatedAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .returning({ id: notifications.id })
  return rows.length
}
