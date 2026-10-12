import { pgTable, text, timestamp, integer, index } from 'drizzle-orm/pg-core'
import { productCatalog } from './catalog'
import { users } from './users'

export const workspaceFiles = pgTable(
  'workspace_files',
  {
    id: text('id').primaryKey(),
    productSlug: text('product_slug')
      .notNull()
      .references(() => productCatalog.slug),
    workspaceId: text('workspace_id').notNull(),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => users.id),
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    s3Key: text('s3_key').notNull().unique(),
    s3Bucket: text('s3_bucket').notNull().default('vianova-files'),
    sha256: text('sha256'),
    status: text('status').notNull().default('active'),
    trashedAt: timestamp('trashed_at'),
    trashedBy: text('trashed_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('workspace_files_product_workspace_status_idx').on(
      t.productSlug,
      t.workspaceId,
      t.status,
    ),
    index('workspace_files_trashed_at_idx').on(t.trashedAt),
  ],
)

export type WorkspaceFile = typeof workspaceFiles.$inferSelect
export type NewWorkspaceFile = typeof workspaceFiles.$inferInsert
