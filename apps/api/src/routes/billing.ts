import { Elysia, t } from 'elysia'
import type Stripe from 'stripe'
import {
  db,
  users,
  organizations,
  organizationMembers,
  productCatalog,
  productPlans,
  productAddonTypes,
  productSubscriptions,
  productSubscriptionAddons,
  invoices,
} from '@vianova/db'
import type { ProductSubscription } from '@vianova/db'
import { eq, and, or, inArray, notInArray } from 'drizzle-orm'
import { generateId } from '../lib/crypto'
import { getStripe } from '../lib/stripe'
import { enqueue } from '../lib/queue'
import {
  sendSubscriptionConfirmedEmail,
  sendPlanChangedEmail,
  sendCancelScheduledEmail,
  sendSubscriptionEndedEmail,
  sendPaymentFailedEmail,
} from '../lib/email'
import { authPlugin } from '../plugins/auth'

const WEB_URL = process.env.VIANOVA_WEB_URL ?? 'http://localhost:3000'

const ACTIVE_STRIPE_STATUSES = ['active', 'trialing', 'past_due']

function hasActiveStripeSubscription(row: ProductSubscription): boolean {
  return Boolean(row.stripeSubscriptionId) && ACTIVE_STRIPE_STATUSES.includes(row.status)
}

// Versões novas da API do Stripe movem current_period_* pro item da
// subscription; versões antigas mantêm no topo. Lê dos dois lugares.
function subscriptionPeriod(sub: Stripe.Subscription): { start: Date | null; end: Date | null } {
  const legacy = sub as Stripe.Subscription & {
    current_period_start?: number
    current_period_end?: number
  }
  const item = sub.items?.data?.[0] as
    | (Stripe.SubscriptionItem & { current_period_start?: number; current_period_end?: number })
    | undefined
  const start = legacy.current_period_start ?? item?.current_period_start
  const end = legacy.current_period_end ?? item?.current_period_end
  return {
    start: start ? new Date(start * 1000) : null,
    end: end ? new Date(end * 1000) : null,
  }
}

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

// Notificações de billing vão sempre pro dono do workspace, respeitando a
// preferência billingAlerts da conta.
async function notifyOwner(
  row: ProductSubscription,
  fn: (email: string, name: string) => Promise<void>,
) {
  if (!row.ownerUserId) return
  const [user] = await db.select().from(users).where(eq(users.id, row.ownerUserId)).limit(1)
  if (!user || user.preferences?.billingAlerts === false) return
  try {
    await fn(user.email, user.name)
  } catch (err) {
    console.error('[billing:email]', err)
  }
}

async function getProductName(productSlug: string): Promise<string> {
  const [product] = await db
    .select({ name: productCatalog.name })
    .from(productCatalog)
    .where(eq(productCatalog.slug, productSlug))
    .limit(1)
  return product?.name ?? productSlug
}

// Add-ons são cotas mensais, não serviço por tempo: quem compra no meio do
// ciclo recebe a cota inteira na hora, então paga o preço cheio — nada de
// proração por dias. Cobra o delta imediatamente numa fatura própria, usando
// o cartão da assinatura.
async function chargeAddonNow(
  stripe: Stripe,
  subRow: ProductSubscription,
  addonName: string,
  unitPriceCents: number,
  quantityDelta: number,
): Promise<number> {
  if (!subRow.stripeCustomerId || quantityDelta <= 0) return 0
  const amount = unitPriceCents * quantityDelta

  await stripe.invoiceItems.create({
    customer: subRow.stripeCustomerId,
    amount,
    currency: 'brl',
    description: `${addonName} × ${quantityDelta} — ciclo atual`,
  })

  const stripeSub = await stripe.subscriptions.retrieve(subRow.stripeSubscriptionId!)
  const paymentMethod =
    typeof stripeSub.default_payment_method === 'string'
      ? stripeSub.default_payment_method
      : (stripeSub.default_payment_method?.id ?? undefined)

  const invoice = await stripe.invoices.create({
    customer: subRow.stripeCustomerId,
    default_payment_method: paymentMethod,
    auto_advance: true,
    // Sem isso, versões novas da API deixam o invoice item pendurado pra
    // próxima renovação em vez de cobrá-lo nesta fatura.
    pending_invoice_items_behavior: 'include',
  })
  await stripe.invoices.finalizeInvoice(invoice.id)
  try {
    await stripe.invoices.pay(invoice.id)
  } catch {
    // Cartão recusado: o webhook invoice.payment_failed avisa o dono.
  }
  return amount
}

// Numa subscription do Stripe, o item do plano é o único cujo price não
// pertence a nenhum add-on do produto.
async function findBasePlanItem(
  stripeSub: Stripe.Subscription,
  productSlug: string,
): Promise<Stripe.SubscriptionItem | null> {
  const addonTypes = await db
    .select({ stripePriceId: productAddonTypes.stripePriceId })
    .from(productAddonTypes)
    .where(eq(productAddonTypes.productSlug, productSlug))

  const addonPriceIds = new Set(addonTypes.map((a) => a.stripePriceId).filter(Boolean))
  return stripeSub.items.data.find((item) => !addonPriceIds.has(item.price.id)) ?? null
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
        apiUrl: productCatalog.apiUrl,
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
          addonTypeId: productSubscriptionAddons.addonTypeId,
          quantity: productSubscriptionAddons.quantity,
          name: productAddonTypes.name,
          key: productAddonTypes.key,
          unitLabel: productAddonTypes.unitLabel,
          priceCents: productAddonTypes.priceCents,
          limitsPerUnit: productAddonTypes.limitsPerUnit,
        })
        .from(productSubscriptionAddons)
        .innerJoin(productAddonTypes, eq(productSubscriptionAddons.addonTypeId, productAddonTypes.id))
        .where(eq(productSubscriptionAddons.productSubscriptionId, row.subscription.id))

      const subInvoices = await db
        .select()
        .from(invoices)
        .where(eq(invoices.productSubscriptionId, row.subscription.id))

      const plan = row.plan && row.plan.tier === 'free' && row.product.slug === 'naia'
        ? {
            ...row.plan,
            limits: {
              ...row.plan.limits,
              messagesPerMonth: 3,
              campaignsPerMonth: 1,
            },
          }
        : row.plan

      let usage: Record<string, number> | null = null
      if (row.product.apiUrl) {
        try {
          const secret = process.env.NAIA_INTERNAL_SECRET ?? 'naia-internal-secret'
          const res = await fetch(`${row.product.apiUrl}/internal/usage/${row.subscription.workspaceId}`, {
            headers: {
              'x-internal-secret': secret,
            },
            signal: AbortSignal.timeout(1500),
          })
          if (res.ok) {
            const data = (await res.json()) as { usage?: Record<string, number> }
            if (data?.usage) usage = data.usage
          }
        } catch {
          // Fallback silencioso se o serviço estiver offline
        }
      }
      if (!usage && row.product.slug === 'naia') {
        usage = { seats: 1, connections: 1, messagesPerMonth: 0, campaignsPerMonth: 0 }
      }

      return { ...row, plan, addons, invoices: subInvoices, usage }
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

  // Estado da assinatura de um workspace de produto — consumido pelo próprio
  // produto (cross-origin, cookie de sessão do Vianova) pra renderizar a tela
  // de assinatura sem falar com o Stripe.
  .get(
    '/billing/subscription',
    async ({ session, query, set }) => {
      if (!session) {
        set.status = 401
        return { message: 'Não autenticado.' }
      }

      const [row] = await db
        .select()
        .from(productSubscriptions)
        .where(
          and(
            eq(productSubscriptions.productSlug, query.product_slug),
            eq(productSubscriptions.workspaceId, query.workspace_id),
          ),
        )
        .limit(1)

      if (!row) return { subscription: null }

      const [plan] = row.planId
        ? await db.select().from(productPlans).where(eq(productPlans.id, row.planId)).limit(1)
        : []

      const addons = await db
        .select({
          addonTypeId: productSubscriptionAddons.addonTypeId,
          quantity: productSubscriptionAddons.quantity,
          key: productAddonTypes.key,
          name: productAddonTypes.name,
          unitLabel: productAddonTypes.unitLabel,
          priceCents: productAddonTypes.priceCents,
          limitsPerUnit: productAddonTypes.limitsPerUnit,
        })
        .from(productSubscriptionAddons)
        .innerJoin(productAddonTypes, eq(productSubscriptionAddons.addonTypeId, productAddonTypes.id))
        .where(eq(productSubscriptionAddons.productSubscriptionId, row.id))

      return {
        subscription: {
          id: row.id,
          status: row.status,
          cancelAtPeriodEnd: row.cancelAtPeriodEnd,
          currentPeriodEnd: row.currentPeriodEnd,
          hasStripeSubscription: Boolean(row.stripeSubscriptionId),
          isOwner: row.ownerUserId === session.userId,
          plan: plan
            ? { id: plan.id, tier: plan.tier, name: plan.name, priceCents: plan.priceCents }
            : null,
          addons,
        },
      }
    },
    {
      query: t.Object({
        product_slug: t.String(),
        workspace_id: t.String(),
      }),
    },
  )

  // Assina, troca de plano ou agenda downgrade pra grátis — o produto chama
  // esta rota cross-origin; o browser só sai do produto pra ir ao Stripe.
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

      // Plano pago "ativo" sem subscription no Stripe é resquício do fluxo
      // antigo (ativação direta no banco) — deixa passar pro checkout de
      // verdade em vez de bloquear como "plano atual".
      if (
        subRow!.planId === plan.id &&
        subRow!.status === 'active' &&
        !subRow!.cancelAtPeriodEnd &&
        (plan.priceCents === 0 || hasActiveStripeSubscription(subRow!))
      ) {
        set.status = 400
        return { message: 'Este já é o plano atual do workspace.' }
      }

      const stripe = getStripe()

      // Plano grátis: com assinatura paga ativa, vira downgrade agendado —
      // o plano pago permanece até o fim do período já cobrado.
      if (plan.priceCents === 0) {
        if (hasActiveStripeSubscription(subRow!)) {
          if (!stripe) {
            set.status = 503
            return { message: 'Stripe não configurado neste ambiente.' }
          }
          const stripeSub = await stripe.subscriptions.update(subRow!.stripeSubscriptionId!, {
            cancel_at_period_end: true,
          })
          const periodEnd = subscriptionPeriod(stripeSub).end ?? subRow!.currentPeriodEnd ?? new Date()

          await db
            .update(productSubscriptions)
            .set({ cancelAtPeriodEnd: true, currentPeriodEnd: periodEnd, updatedAt: new Date() })
            .where(eq(productSubscriptions.id, subRow!.id))

          const productName = await getProductName(body.product_slug)
          const [currentPlan] = subRow!.planId
            ? await db.select().from(productPlans).where(eq(productPlans.id, subRow!.planId)).limit(1)
            : []
          await notifyOwner(subRow!, (email, name) =>
            sendCancelScheduledEmail(email, name, productName, currentPlan?.name ?? 'atual', periodEnd),
          )

          return { scheduled: true as const, effectiveAt: periodEnd.toISOString() }
        }

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

      // Plano pago sem price configurado é erro de ambiente — nunca ativa direto.
      if (!plan.stripePriceId) {
        set.status = 503
        return { message: 'Preço deste plano não está configurado. Tente novamente mais tarde.' }
      }

      if (!stripe) {
        set.status = 503
        return { message: 'Stripe não configurado neste ambiente.' }
      }

      // Assinatura paga já ativa: troca de plano em cima da subscription
      // existente, com proração — sem novo checkout.
      if (hasActiveStripeSubscription(subRow!)) {
        const stripeSub = await stripe.subscriptions.retrieve(subRow!.stripeSubscriptionId!)
        const baseItem = await findBasePlanItem(stripeSub, body.product_slug)

        await stripe.subscriptions.update(subRow!.stripeSubscriptionId!, {
          items: [
            baseItem
              ? { id: baseItem.id, price: plan.stripePriceId }
              : { price: plan.stripePriceId, quantity: 1 },
          ],
          proration_behavior: 'always_invoice',
          cancel_at_period_end: false,
          metadata: { ...stripeSub.metadata, planId: plan.id },
        })

        await db
          .update(productSubscriptions)
          .set({ planId: plan.id, cancelAtPeriodEnd: false, status: 'active', updatedAt: new Date() })
          .where(eq(productSubscriptions.id, subRow!.id))

        await enqueue({
          type: 'entitlements:sync',
          productSlug: body.product_slug,
          workspaceId: body.workspace_id,
        })

        const productName = await getProductName(body.product_slug)
        await notifyOwner(subRow!, (email, name) =>
          sendPlanChangedEmail(email, name, productName, plan.name),
        )

        return { changed: true as const }
      }

      const customerId = await getOrCreateStripeCustomer(stripe, subRow!.id)

      const checkout = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: plan.stripePriceId, quantity: 1 }],
        // O produto chamador passa suas próprias URLs — assinar acontece
        // dentro do produto, o usuário nunca vê o vianova-web nesse fluxo.
        success_url: body.success_url ?? `${WEB_URL}/billing?success=true`,
        cancel_url: body.cancel_url ?? `${WEB_URL}/billing`,
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
        // URLs de retorno dentro do produto — o produto é quem sabe pra onde
        // voltar depois do Stripe.
        success_url: t.Optional(t.String()),
        cancel_url: t.Optional(t.String()),
      }),
    },
  )

  // Cancela no fim do período já pago — o workspace volta ao grátis depois.
  .post('/billing/subscriptions/:id/cancel', async ({ session, params, set }) => {
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
    if (!hasActiveStripeSubscription(subRow)) {
      set.status = 400
      return { message: 'Não há assinatura paga ativa para cancelar.' }
    }
    if (subRow.cancelAtPeriodEnd) {
      set.status = 400
      return { message: 'O cancelamento já está agendado.' }
    }

    const stripe = getStripe()
    if (!stripe) {
      set.status = 503
      return { message: 'Stripe não configurado neste ambiente.' }
    }

    const stripeSub = await stripe.subscriptions.update(subRow.stripeSubscriptionId!, {
      cancel_at_period_end: true,
    })
    const periodEnd = subscriptionPeriod(stripeSub).end ?? subRow.currentPeriodEnd ?? new Date()

    await db
      .update(productSubscriptions)
      .set({ cancelAtPeriodEnd: true, currentPeriodEnd: periodEnd, updatedAt: new Date() })
      .where(eq(productSubscriptions.id, subRow.id))

    const productName = await getProductName(subRow.productSlug)
    const [plan] = subRow.planId
      ? await db.select().from(productPlans).where(eq(productPlans.id, subRow.planId)).limit(1)
      : []
    await notifyOwner(subRow, (email, name) =>
      sendCancelScheduledEmail(email, name, productName, plan?.name ?? 'atual', periodEnd),
    )

    return { scheduled: true as const, effectiveAt: periodEnd.toISOString() }
  })

  // Desfaz um cancelamento agendado antes de ele valer.
  .post('/billing/subscriptions/:id/resume', async ({ session, params, set }) => {
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
    if (!subRow.cancelAtPeriodEnd || !subRow.stripeSubscriptionId) {
      set.status = 400
      return { message: 'Não há cancelamento agendado para retomar.' }
    }

    const stripe = getStripe()
    if (!stripe) {
      set.status = 503
      return { message: 'Stripe não configurado neste ambiente.' }
    }

    await stripe.subscriptions.update(subRow.stripeSubscriptionId, {
      cancel_at_period_end: false,
    })

    await db
      .update(productSubscriptions)
      .set({ cancelAtPeriodEnd: false, updatedAt: new Date() })
      .where(eq(productSubscriptions.id, subRow.id))

    return { resumed: true as const }
  })

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
      if (!hasActiveStripeSubscription(subRow)) {
        set.status = 400
        return { message: 'Add-ons exigem uma assinatura paga ativa.' }
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

      // Se o add-on já existe na subscription, ajusta a quantidade do item em
      // vez de criar um item duplicado.
      const [existing] = await db
        .select()
        .from(productSubscriptionAddons)
        .where(
          and(
            eq(productSubscriptionAddons.productSubscriptionId, subRow.id),
            eq(productSubscriptionAddons.addonTypeId, addonType.id),
          ),
        )
        .limit(1)

      // proration 'none': o item entra pelo preço cheio na renovação; o ciclo
      // atual é cobrado à parte, também pelo preço cheio (cota é cota).
      let itemId = existing?.stripeSubscriptionItemId ?? null
      if (itemId) {
        await stripe.subscriptionItems.update(itemId, {
          quantity: body.quantity,
          proration_behavior: 'none',
        })
      } else {
        const item = await stripe.subscriptionItems.create({
          subscription: subRow.stripeSubscriptionId!,
          price: addonType.stripePriceId,
          quantity: body.quantity,
          proration_behavior: 'none',
        })
        itemId = item.id
      }

      const quantityDelta = body.quantity - (existing?.quantity ?? 0)
      const chargedNowCents = await chargeAddonNow(
        stripe,
        subRow,
        addonType.name,
        addonType.priceCents,
        quantityDelta,
      )

      await db
        .insert(productSubscriptionAddons)
        .values({
          id: generateId(),
          productSubscriptionId: subRow.id,
          addonTypeId: addonType.id,
          quantity: body.quantity,
          stripeSubscriptionItemId: itemId,
        })
        .onConflictDoUpdate({
          target: [
            productSubscriptionAddons.productSubscriptionId,
            productSubscriptionAddons.addonTypeId,
          ],
          set: { quantity: body.quantity, stripeSubscriptionItemId: itemId, updatedAt: new Date() },
        })

      await enqueue({
        type: 'entitlements:sync',
        productSlug: subRow.productSlug,
        workspaceId: subRow.workspaceId,
      })

      return { success: true as const, chargedNowCents }
    },
    {
      body: t.Object({
        addon_type_id: t.String(),
        quantity: t.Number({ minimum: 1 }),
      }),
    },
  )

  // Ajusta quantidade de um add-on; quantidade 0 remove o item da subscription.
  .patch(
    '/billing/subscriptions/:id/addons/:addonTypeId',
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

      const [addonRow] = await db
        .select()
        .from(productSubscriptionAddons)
        .where(
          and(
            eq(productSubscriptionAddons.productSubscriptionId, subRow.id),
            eq(productSubscriptionAddons.addonTypeId, params.addonTypeId),
          ),
        )
        .limit(1)

      if (!addonRow) {
        set.status = 404
        return { message: 'Add-on não encontrado nesta assinatura.' }
      }

      const stripe = getStripe()
      if (!stripe) {
        set.status = 503
        return { message: 'Stripe não configurado neste ambiente.' }
      }

      // Cota é cota: aumentar cobra o preço cheio do delta na hora; reduzir
      // ou remover só tira da renovação — sem crédito proporcional.
      if (body.quantity === 0) {
        if (addonRow.stripeSubscriptionItemId) {
          await stripe.subscriptionItems.del(addonRow.stripeSubscriptionItemId, {
            proration_behavior: 'none',
          })
        }
        await db
          .delete(productSubscriptionAddons)
          .where(eq(productSubscriptionAddons.id, addonRow.id))
      } else {
        if (addonRow.stripeSubscriptionItemId) {
          await stripe.subscriptionItems.update(addonRow.stripeSubscriptionItemId, {
            quantity: body.quantity,
            proration_behavior: 'none',
          })
        }
        await db
          .update(productSubscriptionAddons)
          .set({ quantity: body.quantity, updatedAt: new Date() })
          .where(eq(productSubscriptionAddons.id, addonRow.id))
      }

      let chargedNowCents = 0
      const quantityDelta = body.quantity - addonRow.quantity
      if (quantityDelta > 0) {
        const [addonType] = await db
          .select()
          .from(productAddonTypes)
          .where(eq(productAddonTypes.id, addonRow.addonTypeId))
          .limit(1)
        if (addonType) {
          chargedNowCents = await chargeAddonNow(
            stripe,
            subRow,
            addonType.name,
            addonType.priceCents,
            quantityDelta,
          )
        }
      }

      await enqueue({
        type: 'entitlements:sync',
        productSlug: subRow.productSlug,
        workspaceId: subRow.workspaceId,
      })

      return { success: true as const, chargedNowCents }
    },
    {
      body: t.Object({
        quantity: t.Number({ minimum: 0 }),
      }),
    },
  )

  // Portal de gestão do Stripe (trocar cartão, faturas).
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
            cancelAtPeriodEnd: false,
            updatedAt: new Date(),
          })
          .where(eq(productSubscriptions.id, subscriptionRowId))

        await enqueue({ type: 'entitlements:sync', productSlug, workspaceId })

        const [subRow] = await db
          .select()
          .from(productSubscriptions)
          .where(eq(productSubscriptions.id, subscriptionRowId))
          .limit(1)
        if (subRow && planId) {
          const [plan] = await db
            .select()
            .from(productPlans)
            .where(eq(productPlans.id, planId))
            .limit(1)
          const productName = await getProductName(productSlug)
          await notifyOwner(subRow, (email, name) =>
            sendSubscriptionConfirmedEmail(email, name, productName, plan?.name ?? ''),
          )
        }
      }
    }

    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object as Stripe.Subscription
      const meta = sub.metadata ?? {}

      const [subRow] = meta.subscriptionRowId
        ? await db
            .select()
            .from(productSubscriptions)
            .where(eq(productSubscriptions.id, meta.subscriptionRowId))
            .limit(1)
        : await db
            .select()
            .from(productSubscriptions)
            .where(eq(productSubscriptions.stripeSubscriptionId, sub.id))
            .limit(1)

      if (subRow) {
        // Espelha o plano e os add-ons a partir dos items reais da
        // subscription — fonte da verdade é o Stripe.
        const priceIds = sub.items.data.map((item) => item.price.id)

        const [matchedPlan] = priceIds.length
          ? await db
              .select()
              .from(productPlans)
              .where(
                and(
                  eq(productPlans.productSlug, subRow.productSlug),
                  inArray(productPlans.stripePriceId, priceIds),
                ),
              )
              .limit(1)
          : []

        const matchedAddonTypes = priceIds.length
          ? await db
              .select()
              .from(productAddonTypes)
              .where(
                and(
                  eq(productAddonTypes.productSlug, subRow.productSlug),
                  inArray(productAddonTypes.stripePriceId, priceIds),
                ),
              )
          : []

        for (const addonType of matchedAddonTypes) {
          const item = sub.items.data.find((i) => i.price.id === addonType.stripePriceId)
          if (!item) continue
          await db
            .insert(productSubscriptionAddons)
            .values({
              id: generateId(),
              productSubscriptionId: subRow.id,
              addonTypeId: addonType.id,
              quantity: item.quantity ?? 1,
              stripeSubscriptionItemId: item.id,
            })
            .onConflictDoUpdate({
              target: [
                productSubscriptionAddons.productSubscriptionId,
                productSubscriptionAddons.addonTypeId,
              ],
              set: {
                quantity: item.quantity ?? 1,
                stripeSubscriptionItemId: item.id,
                updatedAt: new Date(),
              },
            })
        }

        const keepAddonTypeIds = matchedAddonTypes.map((a) => a.id)
        await db
          .delete(productSubscriptionAddons)
          .where(
            keepAddonTypeIds.length
              ? and(
                  eq(productSubscriptionAddons.productSubscriptionId, subRow.id),
                  notInArray(productSubscriptionAddons.addonTypeId, keepAddonTypeIds),
                )
              : eq(productSubscriptionAddons.productSubscriptionId, subRow.id),
          )

        const period = subscriptionPeriod(sub)
        await db
          .update(productSubscriptions)
          .set({
            status: sub.status,
            planId: matchedPlan?.id ?? subRow.planId,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            ...(period.start ? { currentPeriodStart: period.start } : {}),
            ...(period.end ? { currentPeriodEnd: period.end } : {}),
            updatedAt: new Date(),
          })
          .where(eq(productSubscriptions.id, subRow.id))

        await enqueue({
          type: 'entitlements:sync',
          productSlug: subRow.productSlug,
          workspaceId: subRow.workspaceId,
        })

        // Emails de cancelamento/troca de plano saem só das rotas desta API —
        // o webhook chega em ordem imprevisível em relação ao espelhamento do
        // banco e duplicaria o envio. Aqui só se espelha estado.
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription
      const meta = sub.metadata ?? {}

      const [subRow] = meta.subscriptionRowId
        ? await db
            .select()
            .from(productSubscriptions)
            .where(eq(productSubscriptions.id, meta.subscriptionRowId))
            .limit(1)
        : await db
            .select()
            .from(productSubscriptions)
            .where(eq(productSubscriptions.stripeSubscriptionId, sub.id))
            .limit(1)

      if (subRow) {
        // Assinatura paga acabou: o workspace volta ao plano grátis do produto.
        const [freePlan] = await db
          .select()
          .from(productPlans)
          .where(
            and(
              eq(productPlans.productSlug, subRow.productSlug),
              eq(productPlans.priceCents, 0),
              eq(productPlans.isActive, true),
            ),
          )
          .orderBy(productPlans.sortOrder)
          .limit(1)

        await db
          .delete(productSubscriptionAddons)
          .where(eq(productSubscriptionAddons.productSubscriptionId, subRow.id))

        await db
          .update(productSubscriptions)
          .set({
            planId: freePlan?.id ?? null,
            status: freePlan ? 'active' : 'canceled',
            stripeSubscriptionId: null,
            cancelAtPeriodEnd: false,
            updatedAt: new Date(),
          })
          .where(eq(productSubscriptions.id, subRow.id))

        await enqueue({
          type: 'entitlements:sync',
          productSlug: subRow.productSlug,
          workspaceId: subRow.workspaceId,
        })

        const productName = await getProductName(subRow.productSlug)
        await notifyOwner(subRow, (email, name) =>
          sendSubscriptionEndedEmail(email, name, productName),
        )
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

          if (event.type === 'invoice.payment_failed') {
            const productName = await getProductName(subRow.productSlug)
            await notifyOwner(subRow, (email, name) =>
              sendPaymentFailedEmail(email, name, productName),
            )
          }
        }
      }
    }

    return { received: true }
  })
