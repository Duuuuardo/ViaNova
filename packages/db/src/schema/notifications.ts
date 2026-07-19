import { pgTable, text, timestamp, index, jsonb } from 'drizzle-orm/pg-core'
import { users } from './users'

// Central de notificações da conta Vianova. Recebe eventos da própria
// Vianova (billing, segurança) e de produtos conectados via endpoint
// service-to-service (`POST /internal/notifications`).
export const notifications = pgTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Categoria da notificação: billing, security, product, marketing.
    type: text('type').notNull(),
    // Origem: 'vianova' ou o slug do produto (ex.: 'naia', 'naia-crm').
    source: text('source').notNull(),
    sourceProductSlug: text('source_product_slug'),
    sourceWorkspaceId: text('source_workspace_id'),
    sourceWorkspaceName: text('source_workspace_name'),
    title: text('title').notNull(),
    body: text('body'),
    actionUrl: text('action_url'),
    actionLabel: text('action_label'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    readAt: timestamp('read_at'),
    emailedAt: timestamp('emailed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('notifications_user_read_created_idx').on(t.userId, t.readAt, t.createdAt),
    index('notifications_user_created_idx').on(t.userId, t.createdAt),
  ],
)

export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert
