import { Elysia, t } from 'elysia'
import type Stripe from 'stripe'
import {
  db,
  organizations,
  organizationMembers,
  productCatalog,
  productPlans,
  productAddonTypes,
  productSubscriptions,
  productSubscriptionAddons,
  invoices,
} from '@vianova/db'
import { eq, and, or, inArray } from 'drizzle-orm'
import { generateId } from '../lib/crypto'
import { getStripe } from '../lib/stripe'
import { enqueue } from '../lib/queue'
import { authPlugin } from '../plugins/auth'

const WEB_URL = process.env.VIANOVA_WEB_URL ?? 'http://localhost:3000'

// Customer Stripe é por workspace de produto — nunca por Organização.
async function getOrCreateStripeCustomer(
  stripe: Stripe,
  subscriptionRowId: string,
): Promise<string> {
  const [row] = await db
    .select()
    .from(productSubscriptions)
    .where(eq(productSubscriptions.id, subscriptionRowId))
    .limit(1)

  if (!row) throw new Error('Assinatura não encontrada.')
  if (row.stripeCustomerId) return row.stripeCustomerId

  const customer = await stripe.customers.create({
    name: row.workspaceName ?? `${row.productSlug}/${row.workspaceId}`,
    metadata: { productSlug: row.productSlug, workspaceId: row.workspaceId },
  })

  await db
    .update(productSubscriptions)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(eq(productSubscriptions.id, subscriptionRowId))

  return customer.id
}

async function loadSubscriptionsWithDetails(subIds: string[]) {
  if (subIds.length === 0) return []

  const rows = await db
    .select({
      subscription: productSubscriptions,
      plan: productPlans,
      product: {
        slug: productCatalog.slug,
        name: productCatalog.name,
        domain: productCatalog.domain,
        icon: productCatalog.icon,
        webUrl: productCatalog.webUrl,
      },
    })
    .from(productSubscriptions)
    .innerJoin(productCatalog, eq(productSubscriptions.productSlug, productCatalog.slug))
    .leftJoin(productPlans, eq(productSubscriptions.planId, productPlans.id))
    .where(inArray(productSubscriptions.id, subIds))

  return Promise.all(
    rows.map(async (row) => {
      const addons = await db
        .select({
          id: productSubscriptionAddons.id,
          quantity: productSubscriptionAddons.quantity,
          name: productAddonTypes.name,
          key: productAddonTypes.key,
          unitLabel: productAddonTypes.unitLabel,
          limitsPerUnit: productAddonTypes.limitsPerUnit,
        })
        .from(productSubscriptionAddons)
        .innerJoin(productAddonTypes, eq(productSubscriptionAddons.addonTypeId, productAddonTypes.id))
        .where(eq(productSubscriptionAddons.productSubscriptionId, row.subscription.id))

      const subInvoices = await db
        .select()
        .from(invoices)
        .where(eq(invoices.productSubscriptionId, row.subscription.id))

      return { ...row, addons, invoices: subInvoices }
    }),
  )
}

export const billingRoutes = new Elysia()
  .use(authPlugin)

  // Visão do portal: assinaturas de produto do usuário, agrupáveis por
  // Organização (rótulo de exibição — o titular é sempre o workspace).
  .get('/billing/overview', async ({ session, set }) => {
    if (!session) {
      set.status = 401
      return { message: 'Não autenticado.' }
    }

    const memberOrgs = await db
      .select({ organization: organizations })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(eq(organizationMembers.userId, session.userId))

    const orgIds = memberOrgs.map((r) => r.organization.id)

    const subRows = await db
      .select({ id: productSubscriptions.id })
      .from(productSubscriptions)
      .where(
        orgIds.length > 0
          ? or(
              eq(productSubscriptions.ownerUserId, session.userId),
              inArray(productSubscriptions.organizationId, orgIds),
            )
          : eq(productSubscriptions.ownerUserId, session.userId),
      )

    const subscriptions = await loadSubscriptionsWithDetails(subRows.map((r) => r.id))

    return {
      organizations: memberOrgs.map((r) => r.organization),
      subscriptions,
    }
  })

  // Inicia assinatura de um produto para um workspace. Em produção o produto
  // redireciona pra cá com o workspace_id dele; o checkout é sempre no Vianova.
  .post(
    '/billing/checkout',
    async ({ session, body, set }) => {
      if (!session) {
        set.status = 401
        return { message: 'Não autenticado.' }
      }

      const [plan] = await db
        .select()
        .from(productPlans)
        .where(
          and(
            eq(productPlans.id, body.plan_id),
            eq(productPlans.productSlug, body.product_slug),
            eq(productPlans.isActive, true),
          ),
        )
        .limit(1)

      if (!plan) {
        set.status = 400
        return { message: 'Plano inválido.' }
      }

      if (body.organization_id) {
        const [membership] = await db
          .select()
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.organizationId, body.organization_id),
              eq(organizationMembers.userId, session.userId),
            ),
          )
          .limit(1)
        if (!membership) {
          set.status = 403
          return { message: 'Você não é membro desta organização.' }
        }
      }

      let [subRow] = await db
        .select()
        .from(productSubscriptions)
        .where(
          and(
            eq(productSubscriptions.productSlug, body.product_slug),
            eq(productSubscriptions.workspaceId, body.workspace_id),
          ),
        )
        .limit(1)

      if (subRow && subRow.ownerUserId && subRow.ownerUserId !== session.userId) {
        set.status = 403
        return { message: 'Apenas o dono do workspace pode gerenciar a assinatura.' }
      }

      if (!subRow) {
        ;[subRow] = await db
          .insert(productSubscriptions)
          .values({
            id: generateId(),
            productSlug: body.product_slug,
            workspaceId: body.workspace_id,
            workspaceName: body.workspace_name ?? null,
            organizationId: body.organization_id ?? null,
            ownerUserId: session.userId,
            status: 'none',
          })
          .returning()
      }

      // Plano gratuito não passa pelo Stripe: ativa e sincroniza direto.
      if (!plan.stripePriceId || plan.priceCents === 0) {
        await db
          .update(productSubscriptions)
          .set({ planId: plan.id, status: 'active', updatedAt: new Date() })
          .where(eq(productSubscriptions.id, subRow!.id))

        await enqueue({
          type: 'entitlements:sync',
          productSlug: body.product_slug,
          workspaceId: body.workspace_id,
        })

        return { activated: true as const }
      }

      const stripe = getStripe()
      if (!stripe) {
        set.status = 503
        return { message: 'Stripe não configurado neste ambiente.' }
      }

      const customerId = await getOrCreateStripeCustomer(stripe, subRow!.id)

      const checkout = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: plan.stripePriceId, quantity: 1 }],
        success_url: `${WEB_URL}/billing?success=true`,
        cancel_url: `${WEB_URL}/billing`,
        subscription_data: {
          metadata: {
            subscriptionRowId: subRow!.id,
            productSlug: body.product_slug,
            workspaceId: body.workspace_id,
            planId: plan.id,
          },
        },
        metadata: {
          subscriptionRowId: subRow!.id,
          productSlug: body.product_slug,
          workspaceId: body.workspace_id,
          planId: plan.id,
        },
      })

      return { checkoutUrl: checkout.url }
    },
    {
      body: t.Object({
        product_slug: t.String(),
        workspace_id: t.String(),
        workspace_name: t.Optional(t.String()),
        plan_id: t.String(),
        organization_id: t.Optional(t.String()),
      }),
    },
  )

  // Compra de add-on numa assinatura ativa (item extra na subscription Stripe).
  .post(
    '/billing/subscriptions/:id/addons',
    async ({ session, params, body, set }) => {
      if (!session) {
        set.status = 401
        return { message: 'Não autenticado.' }
      }

      const [subRow] = await db
        .select()
        .from(productSubscriptions)
        .where(eq(productSubscriptions.id, params.id))
        .limit(1)

      if (!subRow) {
        set.status = 404
        return { message: 'Assinatura não encontrada.' }
      }
      if (subRow.ownerUserId !== session.userId) {
        set.status = 403
        return { message: 'Apenas o dono do workspace pode gerenciar a assinatura.' }
      }
      if (subRow.status !== 'active' || !subRow.stripeSubscriptionId) {
        set.status = 400
        return { message: 'A assinatura precisa estar ativa para comprar add-ons.' }
      }

      const [addonType] = await db
        .select()
        .from(productAddonTypes)
        .where(
          and(
            eq(productAddonTypes.id, body.addon_type_id),
            eq(productAddonTypes.productSlug, subRow.productSlug),
            eq(productAddonTypes.isActive, true),
          ),
        )
        .limit(1)

      if (!addonType?.stripePriceId) {
        set.status = 400
        return { message: 'Add-on inválido ou sem preço configurado.' }
      }

      const stripe = getStripe()
      if (!stripe) {
        set.status = 503
        return { message: 'Stripe não configurado neste ambiente.' }
      }

      const item = await stripe.subscriptionItems.create({
        subscription: subRow.stripeSubscriptionId,
        price: addonType.stripePriceId,
        quantity: body.quantity,
      })

      await db
        .insert(productSubscriptionAddons)
        .values({
          id: generateId(),
          productSubscriptionId: subRow.id,
          addonTypeId: addonType.id,
          quantity: body.quantity,
          stripeSubscriptionItemId: item.id,
        })
        .onConflictDoUpdate({
          target: [
            productSubscriptionAddons.productSubscriptionId,
            productSubscriptionAddons.addonTypeId,
          ],
          set: { quantity: body.quantity, stripeSubscriptionItemId: item.id, updatedAt: new Date() },
        })

      await enqueue({
        type: 'entitlements:sync',
        productSlug: subRow.productSlug,
        workspaceId: subRow.workspaceId,
      })

      return { success: true as const }
    },
    {
      body: t.Object({
        addon_type_id: t.String(),
        quantity: t.Number({ minimum: 1 }),
      }),
    },
  )

  // Portal de gestão do Stripe (trocar cartão, cancelar, faturas).
  .post('/billing/subscriptions/:id/portal', async ({ session, params, set }) => {
    if (!session) {
      set.status = 401
      return { message: 'Não autenticado.' }
    }

    const [subRow] = await db
      .select()
      .from(productSubscriptions)
      .where(eq(productSubscriptions.id, params.id))
      .limit(1)

    if (!subRow) {
      set.status = 404
      return { message: 'Assinatura não encontrada.' }
    }
    if (subRow.ownerUserId !== session.userId) {
      set.status = 403
      return { message: 'Apenas o dono do workspace pode acessar o portal de cobrança.' }
    }
    if (!subRow.stripeCustomerId) {
      set.status = 400
      return { message: 'Nenhuma cobrança configurada para esta assinatura.' }
    }

    const stripe = getStripe()
    if (!stripe) {
      set.status = 503
      return { message: 'Stripe não configurado neste ambiente.' }
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: subRow.stripeCustomerId,
      return_url: `${WEB_URL}/billing`,
    })

    return { portalUrl: portal.url }
  })

  // Webhook do Stripe: espelha o estado no banco e enfileira o sync de
  // entitlement — a chamada ao produto nunca roda síncrona aqui.
  .post('/webhooks/stripe', async ({ request, set }) => {
    const stripe = getStripe()
    if (!stripe) {
      set.status = 503
      return { message: 'Stripe não configurado neste ambiente.' }
    }

    const sig = request.headers.get('stripe-signature')
    if (!sig) {
      set.status = 400
      return { message: 'Missing signature.' }
    }

    let event: Stripe.Event
    try {
      const rawBody = await request.text()
      event = await stripe.webhooks.constructEventAsync(
        rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!,
      )
    } catch {
      set.status = 400
      return { message: 'Webhook signature verification failed.' }
    }

    if (event.type === 'checkout.session.completed') {
      const checkout = event.data.object as Stripe.Checkout.Session
      const { subscriptionRowId, productSlug, workspaceId, planId } = checkout.metadata ?? {}
      if (subscriptionRowId && productSlug && workspaceId && checkout.mode === 'subscription') {
        await db
          .update(productSubscriptions)
          .set({
            stripeSubscriptionId: checkout.subscription as string,
            planId,
            status: 'active',
            updatedAt: new Date(),
          })
          .where(eq(productSubscriptions.id, subscriptionRowId))

        await enqueue({ type: 'entitlements:sync', productSlug, workspaceId })
      }
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription
      const { subscriptionRowId, productSlug, workspaceId } = sub.metadata ?? {}
      if (subscriptionRowId && productSlug && workspaceId) {
        const status = event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status
        await db
          .update(productSubscriptions)
          .set({
            status,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            currentPeriodStart: new Date(sub.current_period_start * 1000),
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            updatedAt: new Date(),
          })
          .where(eq(productSubscriptions.id, subscriptionRowId))

        await enqueue({ type: 'entitlements:sync', productSlug, workspaceId })
      }
    }

    if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice
      const stripeSubId = invoice.subscription as string | null
      if (stripeSubId) {
        const [subRow] = await db
          .select()
          .from(productSubscriptions)
          .where(eq(productSubscriptions.stripeSubscriptionId, stripeSubId))
          .limit(1)

        if (subRow) {
          await db
            .insert(invoices)
            .values({
              id: generateId(),
              productSubscriptionId: subRow.id,
              stripeInvoiceId: invoice.id,
              status: invoice.status ?? 'open',
              amountDueCents: invoice.amount_due,
              amountPaidCents: invoice.amount_paid,
              currency: invoice.currency,
              hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
            })
            .onConflictDoUpdate({
              target: invoices.stripeInvoiceId,
              set: {
                status: invoice.status ?? 'open',
                amountPaidCents: invoice.amount_paid,
                hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
              },
            })
        }
      }
    }

    return { received: true }
  })
