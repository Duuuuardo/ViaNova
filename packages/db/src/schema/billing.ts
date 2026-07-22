import { pgTable, text, timestamp, boolean, integer, uniqueIndex } from 'drizzle-orm/pg-core'
import { users } from './users'
import { organizations } from './organizations'
import { productCatalog, productPlans, productAddonTypes } from './catalog'

// Assinatura por workspace de produto — o workspace (que vive no banco do
// produto) é o titular; workspace_id aqui é um ID externo, não FK.
// Customer Stripe é por workspace de produto, nunca por Organização.
export const productSubscriptions = pgTable(
  'product_subscriptions',
  {
    id: text('id').primaryKey(),
    productSlug: text('product_slug')
      .notNull()
      .references(() => productCatalog.slug),
    workspaceId: text('workspace_id').notNull(),
    workspaceName: text('workspace_name'),
    organizationId: text('organization_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
    ownerUserId: text('owner_user_id').references(() => users.id),
    // Elegibilidade vitalícia concedida pelo produto. Registrar um workspace
    // no billing não significa que ele pode ativar o plano grátis.
    freeEligible: boolean('free_eligible').notNull().default(true),
    planId: text('plan_id').references(() => productPlans.id),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    status: text('status').notNull().default('none'),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    currentPeriodStart: timestamp('current_period_start'),
    currentPeriodEnd: timestamp('current_period_end'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('product_subs_product_workspace_idx').on(t.productSlug, t.workspaceId)],
)

export const productSubscriptionAddons = pgTable(
  'product_subscription_addons',
  {
    id: text('id').primaryKey(),
    productSubscriptionId: text('product_subscription_id')
      .notNull()
      .references(() => productSubscriptions.id, { onDelete: 'cascade' }),
    addonTypeId: text('addon_type_id')
      .notNull()
      .references(() => productAddonTypes.id),
    quantity: integer('quantity').notNull().default(1),
    stripeSubscriptionItemId: text('stripe_subscription_item_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('product_sub_addons_sub_type_idx').on(t.productSubscriptionId, t.addonTypeId)],
)

// Espelho de faturas do Stripe, só para exibição no portal.
export const invoices = pgTable('invoices', {
  id: text('id').primaryKey(),
  productSubscriptionId: text('product_subscription_id')
    .notNull()
    .references(() => productSubscriptions.id, { onDelete: 'cascade' }),
  stripeInvoiceId: text('stripe_invoice_id').notNull().unique(),
  status: text('status').notNull(),
  amountDueCents: integer('amount_due_cents').notNull().default(0),
  amountPaidCents: integer('amount_paid_cents').notNull().default(0),
  currency: text('currency').notNull().default('brl'),
  hostedInvoiceUrl: text('hosted_invoice_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Registro idempotente dos reembolsos recebidos do Stripe. O escopo vem da
// metadata gravada pelo Vianova ao criar o refund; reembolsos externos sem
// metadata nunca removem um add-on por inferência de valor.
export const billingRefunds = pgTable('billing_refunds', {
  id: text('id').primaryKey(),
  stripeRefundId: text('stripe_refund_id').notNull().unique(),
  stripeChargeId: text('stripe_charge_id').notNull(),
  stripeInvoiceId: text('stripe_invoice_id'),
  productSubscriptionId: text('product_subscription_id')
    .references(() => productSubscriptions.id, { onDelete: 'set null' }),
  scope: text('scope').$type<'subscription' | 'addon' | 'external'>().notNull(),
  addonTypeId: text('addon_type_id').references(() => productAddonTypes.id, {
    onDelete: 'set null',
  }),
  addonQuantity: integer('addon_quantity'),
  addonQuantityAfter: integer('addon_quantity_after'),
  amountCents: integer('amount_cents').notNull(),
  currency: text('currency').notNull().default('brl'),
  status: text('status').notNull(),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type ProductSubscription = typeof productSubscriptions.$inferSelect
export type ProductSubscriptionAddon = typeof productSubscriptionAddons.$inferSelect
export type Invoice = typeof invoices.$inferSelect
export type BillingRefund = typeof billingRefunds.$inferSelect
