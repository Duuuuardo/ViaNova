import { pgTable, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core'

export const productCatalog = pgTable('product_catalog', {
  slug: text('slug').primaryKey(),
  name: text('name').notNull(),
  domain: text('domain').notNull(),
  description: text('description'),
  icon: text('icon'),
  webUrl: text('web_url').notNull(),
  apiUrl: text('api_url').notNull(),
  oidcClientSecretHash: text('oidc_client_secret_hash').notNull(),
  redirectUris: text('redirect_uris').array().notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const productPlans = pgTable('product_plans', {
  id: text('id').primaryKey(),
  productSlug: text('product_slug')
    .notNull()
    .references(() => productCatalog.slug, { onDelete: 'cascade' }),
  tier: text('tier').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  priceCents: integer('price_cents').notNull().default(0),
  stripePriceId: text('stripe_price_id'),
  limits: jsonb('limits').$type<Record<string, number>>().notNull().default({}),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const productAddonTypes = pgTable('product_addon_types', {
  id: text('id').primaryKey(),
  productSlug: text('product_slug')
    .notNull()
    .references(() => productCatalog.slug, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  unitLabel: text('unit_label'),
  priceCents: integer('price_cents').notNull().default(0),
  stripePriceId: text('stripe_price_id'),
  limitsPerUnit: jsonb('limits_per_unit').$type<Record<string, number>>().notNull().default({}),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type Product = typeof productCatalog.$inferSelect
export type ProductPlan = typeof productPlans.$inferSelect
export type ProductAddonType = typeof productAddonTypes.$inferSelect
