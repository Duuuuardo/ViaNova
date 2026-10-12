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
  billingRefunds,
  stripeWebhookEvents,
  auditLogs,
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
  sendInvoicePaidEmail,
  sendUpcomingRenewalEmail,
} from '../lib/email'
import { notifyUser } from '../lib/notifications'
import { authPlugin } from '../plugins/auth'
import { getRequiredSecret, getOptionalSecret, verifySecret } from '../lib/secrets'
import { requireEnv } from '../lib/env'

const WEB_URL = requireEnv('VIANOVA_WEB_URL')

const ACTIVE_STRIPE_STATUSES = ['active', 'trialing', 'past_due']

function hasActiveStripeSubscription(row: ProductSubscription): boolean {
  return Boolean(row.stripeSubscriptionId) && ACTIVE_STRIPE_STATUSES.includes(row.status)
}

const INTERNAL_SECRET = getRequiredSecret('VIANOVA_INTERNAL_SECRET')
const INTERNAL_ADMIN_SECRET = getRequiredSecret('INTERNAL_ADMIN_SECRET')

function verifyInternalSecret(headers: Record<string, string | undefined>) {
  return verifySecret(headers['x-internal-secret'], INTERNAL_SECRET)
}

async function ensureFreeSubscription(data: {
  productSlug: string
  workspaceId: string
  workspaceName?: string | null
  ownerUserId: string
  organizationId?: string | null
  freeEligible: boolean
}) {
  const [existing] = await db
    .select()
    .from(productSubscriptions)
    .where(
      and(
        eq(productSubscriptions.productSlug, data.productSlug),
        eq(productSubscriptions.workspaceId, data.workspaceId),
      ),
    )
    .limit(1)

  if (existing) return existing

  const [freePlan] = await db
    .select()
    .from(productPlans)
    .where(and(eq(productPlans.productSlug, data.productSlug), eq(productPlans.priceCents, 0)))
    .limit(1)

  if (!freePlan) throw new Error(`Plano grátis não encontrado para ${data.productSlug}`)

  const [sub] = await db
    .insert(productSubscriptions)
    .values({
      id: generateId(),
      productSlug: data.productSlug,
      workspaceId: data.workspaceId,
      workspaceName: data.workspaceName ?? null,
      organizationId: data.organizationId ?? null,
      ownerUserId: data.ownerUserId,
      freeEligible: data.freeEligible,
      planId: freePlan.id,
      status: data.freeEligible ? 'active' : 'inactive',
    })
    .onConflictDoNothing({
      target: [productSubscriptions.productSlug, productSubscriptions.workspaceId],
    })
    .returning()

  if (!sub) {
    const [raced] = await db
      .select()
      .from(productSubscriptions)
      .where(
        and(
          eq(productSubscriptions.productSlug, data.productSlug),
          eq(productSubscriptions.workspaceId, data.workspaceId),
        ),
      )
      .limit(1)
    if (raced) return raced
    throw new Error(`Assinatura não encontrada para ${data.productSlug}/${data.workspaceId}`)
  }

  if (data.freeEligible) {
    await enqueue({
      type: 'entitlements:sync',
      productSlug: data.productSlug,
      workspaceId: data.workspaceId,
    })
  }

  return sub
}

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

async function notifyBillingOwner(
  row: ProductSubscription,
  options: {
    title: string
    body: string
    actionUrl?: string
    actionLabel?: string
    metadata?: Record<string, unknown>
    email: (email: string, name: string) => Promise<void>
  },
) {
  if (!row.ownerUserId) return
  const [user] = await db.select().from(users).where(eq(users.id, row.ownerUserId)).limit(1)
  if (!user) return

  try {
    await notifyUser({
      userId: user.id,
      type: 'billing',
      source: 'vianova',
      sourceProductSlug: row.productSlug,
      sourceWorkspaceId: row.workspaceId,
      sourceWorkspaceName: row.workspaceName,
      title: options.title,
      body: options.body,
      actionUrl: options.actionUrl ?? `${WEB_URL}/billing`,
      actionLabel: options.actionLabel ?? 'Ver assinaturas',
      metadata: options.metadata ?? {},
      email: {
        to: user.email,
        name: user.name,
        send: options.email,
      },
    })
  } catch (err) {
    console.error('[billing:notify]', err)
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

async function chargeAddonNow(
  stripe: Stripe,
  subRow: ProductSubscription,
  addonTypeId: string,
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
    pending_invoice_items_behavior: 'include',
    metadata: {
      subscriptionRowId: subRow.id,
      productSlug: subRow.productSlug,
      workspaceId: subRow.workspaceId,
      billingScope: 'addon',
      addonTypeId,
      addonQuantity: String(quantityDelta),
    },
  })
  await stripe.invoices.finalizeInvoice(invoice.id)
  try {
    await stripe.invoices.pay(invoice.id)
  } catch {
  }
  return amount
}

async function findSubscriptionForRefund(
  stripe: Stripe,
  charge: Stripe.Charge,
  refund: Stripe.Refund,
): Promise<{ subRow: ProductSubscription | null; invoice: Stripe.Invoice | null }> {
  let invoice: Stripe.Invoice | null = null
  const invoiceId = typeof charge.invoice === 'string' ? charge.invoice : charge.invoice?.id
  if (invoiceId) invoice = await stripe.invoices.retrieve(invoiceId)

  const rowId = refund.metadata?.subscriptionRowId || invoice?.metadata?.subscriptionRowId
  if (rowId) {
    const [subRow] = await db
      .select()
      .from(productSubscriptions)
      .where(eq(productSubscriptions.id, rowId))
      .limit(1)
    return { subRow: subRow ?? null, invoice }
  }

  const stripeSubId = typeof invoice?.subscription === 'string'
    ? invoice.subscription
    : invoice?.subscription?.id
  if (!stripeSubId) return { subRow: null, invoice }
  const [subRow] = await db
    .select()
    .from(productSubscriptions)
    .where(eq(productSubscriptions.stripeSubscriptionId, stripeSubId))
    .limit(1)
  return { subRow: subRow ?? null, invoice }
}

async function processRefund(stripe: Stripe, charge: Stripe.Charge, refund: Stripe.Refund) {
  if (refund.status !== 'succeeded') return

  const { subRow, invoice } = await findSubscriptionForRefund(stripe, charge, refund)
  const requestedScope = refund.metadata?.billingScope
  const scope: 'subscription' | 'addon' | 'external' =
    requestedScope === 'subscription' || requestedScope === 'addon' ? requestedScope : 'external'
  const addonTypeId = scope === 'addon'
    ? (refund.metadata?.addonTypeId || invoice?.metadata?.addonTypeId || null)
    : null
  const addonQuantityRaw = scope === 'addon'
    ? (refund.metadata?.addonQuantity || invoice?.metadata?.addonQuantity)
    : undefined
  const addonQuantity = addonQuantityRaw ? Number(addonQuantityRaw) : null
  const addonQuantityAfterRaw = scope === 'addon' ? refund.metadata?.addonQuantityAfter : undefined
  const addonQuantityAfter = addonQuantityAfterRaw ? Number(addonQuantityAfterRaw) : null

  const [refundRow] = await db
    .insert(billingRefunds)
    .values({
      id: generateId(),
      stripeRefundId: refund.id,
      stripeChargeId: charge.id,
      stripeInvoiceId: invoice?.id ?? null,
      productSubscriptionId: subRow?.id ?? null,
      scope,
      addonTypeId,
      addonQuantity: Number.isInteger(addonQuantity) ? addonQuantity : null,
      addonQuantityAfter: Number.isInteger(addonQuantityAfter) ? addonQuantityAfter : null,
      amountCents: refund.amount,
      currency: refund.currency,
      status: refund.status,
    })
    .onConflictDoUpdate({
      target: billingRefunds.stripeRefundId,
      set: { status: refund.status, updatedAt: new Date() },
    })
    .returning({ id: billingRefunds.id, processedAt: billingRefunds.processedAt })

  if (!refundRow || refundRow.processedAt || !subRow) return

  if (scope === 'addon' && addonTypeId && addonQuantity && addonQuantity > 0 && addonQuantityAfter !== null) {
    const [addon] = await db
      .select()
      .from(productSubscriptionAddons)
      .where(and(
        eq(productSubscriptionAddons.productSubscriptionId, subRow.id),
        eq(productSubscriptionAddons.addonTypeId, addonTypeId),
      ))
      .limit(1)

    if (addon) {
      const nextQuantity = Math.max(0, addonQuantityAfter)
      if (addon.stripeSubscriptionItemId) {
        if (nextQuantity === 0) {
          await stripe.subscriptionItems.del(addon.stripeSubscriptionItemId, { proration_behavior: 'none' })
        } else {
          await stripe.subscriptionItems.update(addon.stripeSubscriptionItemId, {
            quantity: nextQuantity,
            proration_behavior: 'none',
          })
        }
      }
      if (nextQuantity === 0) {
        await db.delete(productSubscriptionAddons).where(eq(productSubscriptionAddons.id, addon.id))
      } else {
        await db
          .update(productSubscriptionAddons)
          .set({ quantity: nextQuantity, updatedAt: new Date() })
          .where(eq(productSubscriptionAddons.id, addon.id))
      }
      await enqueue({ type: 'entitlements:sync', productSlug: subRow.productSlug, workspaceId: subRow.workspaceId })
    }
  } else if (scope === 'subscription' || (scope === 'external' && charge.refunded)) {
    if (subRow.stripeSubscriptionId) {
      await stripe.subscriptions.cancel(subRow.stripeSubscriptionId).catch(() => {})
    }
    await enqueue({ type: 'credits:reset', productSlug: subRow.productSlug, workspaceId: subRow.workspaceId })
  }

  await db
    .update(billingRefunds)
    .set({ processedAt: new Date(), updatedAt: new Date() })
    .where(eq(billingRefunds.id, refundRow.id))
}

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
              creditsPerCycle: 3,
              campaignsPerMonth: 1,
            },
          }
        : row.plan

      let usage: Record<string, number> | null = null
      if (row.product.apiUrl) {
        try {
          const secret = getOptionalSecret('NAIA_INTERNAL_SECRET')
          if (!secret) {
            console.warn('[billing:usage] NAIA_INTERNAL_SECRET not set; skipping usage fetch')
          } else {
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
          }
        } catch {
        }
      }
      if (!usage && row.product.slug === 'naia') {
        usage = { seats: 1, connections: 1, creditsBalance: 0, campaignsPerMonth: 0 }
      }

      return { ...row, plan, addons, invoices: subInvoices, usage }
    }),
  )
}

async function handleStripeEvent(stripe: Stripe, event: Stripe.Event): Promise<void> {
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
        await notifyBillingOwner(subRow, {
          title: 'Assinatura confirmada',
          body: `Sua assinatura do plano ${plan?.name ?? ''} no ${productName} está ativa. Os novos limites do seu workspace já valem a partir de agora.`,
          metadata: { planName: plan?.name ?? '' },
          email: (email, name) => sendSubscriptionConfirmedEmail(email, name, productName, plan?.name ?? ''),
        })
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
      const period = subscriptionPeriod(sub)
      const isActive = ['active', 'trialing'].includes(sub.status)

      if (isActive) {
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
      } else {
        await db
          .update(productSubscriptions)
          .set({
            status: sub.status,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            ...(period.start ? { currentPeriodStart: period.start } : {}),
            ...(period.end ? { currentPeriodEnd: period.end } : {}),
            updatedAt: new Date(),
          })
          .where(eq(productSubscriptions.id, subRow.id))
      }

      await enqueue({
        type: 'entitlements:sync',
        productSlug: subRow.productSlug,
        workspaceId: subRow.workspaceId,
      })

      if (['canceled', 'unpaid'].includes(sub.status)) {
        await enqueue({
          type: 'credits:reset',
          productSlug: subRow.productSlug,
          workspaceId: subRow.workspaceId,
        })
      }

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

      await enqueue({
        type: 'credits:reset',
        productSlug: subRow.productSlug,
        workspaceId: subRow.workspaceId,
      })

      const productName = await getProductName(subRow.productSlug)
      await notifyBillingOwner(subRow, {
        title: 'Assinatura encerrada',
        body: `Sua assinatura do ${productName} foi encerrada e o workspace voltou ao plano grátis. Seus dados continuam intactos.`,
        actionLabel: 'Ver planos',
        metadata: {},
        email: (email, name) => sendSubscriptionEndedEmail(email, name, productName),
      })
    }
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge
    const refunds = await stripe.refunds.list({ charge: charge.id, limit: 100 })
    for (const refund of refunds.data) {
      try {
        await processRefund(stripe, charge, refund)
      } catch (err) {
        console.error(`[billing:webhook] erro ao processar refund ${refund.id}:`, err)
        throw err
      }
    }
  }

  if (event.type === 'charge.dispute.created' || event.type === 'charge.dispute.funds_withdrawn') {
    const dispute = event.data.object as Stripe.Dispute
    const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id
    if (!chargeId) {
return
    }

    try {
      const charge = await stripe.charges.retrieve(chargeId, {
        expand: ['invoice'],
      })
      const invoice = charge.invoice as Stripe.Invoice | undefined
      const stripeSubId = invoice?.subscription as string | undefined
      if (!stripeSubId) {
return
      }

      const [subRow] = await db
        .select()
        .from(productSubscriptions)
        .where(eq(productSubscriptions.stripeSubscriptionId, stripeSubId))
        .limit(1)

      if (subRow) {
        await stripe.subscriptions.cancel(stripeSubId).catch(() => {
        })
        await enqueue({
          type: 'credits:reset',
          productSlug: subRow.productSlug,
          workspaceId: subRow.workspaceId,
        })
      }
    } catch (err) {
      console.error('[billing:webhook] erro ao processar chargeback:', err)
    }
  }

  if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice
    const stripeSubId = typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id
    const subscriptionRowId = invoice.metadata?.subscriptionRowId
    if (stripeSubId || subscriptionRowId) {
      const [subRow] = await db
        .select()
        .from(productSubscriptions)
        .where(subscriptionRowId
          ? eq(productSubscriptions.id, subscriptionRowId)
          : eq(productSubscriptions.stripeSubscriptionId, stripeSubId!))
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
          await notifyBillingOwner(subRow, {
            title: 'Falha no pagamento',
            body: `Não conseguimos processar o pagamento da sua assinatura do ${productName}. Vamos tentar de novo automaticamente. Se o problema persistir, atualize a forma de pagamento para não perder acesso ao seu plano.`,
            actionLabel: 'Atualizar pagamento',
            email: (email, name) => sendPaymentFailedEmail(email, name, productName),
          })
        }

        if (event.type === 'invoice.paid') {
          const inv = event.data.object as Stripe.Invoice & { billing_reason?: string }
          const productName = await getProductName(subRow.productSlug)
          await notifyBillingOwner(subRow, {
            title: 'Pagamento confirmado',
            body: `Recebemos o pagamento da sua assinatura do ${productName} no valor de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: invoice.currency.toUpperCase() }).format(invoice.amount_paid / 100)} em ${new Date(invoice.created * 1000).toLocaleDateString('pt-BR')}.`,
            actionUrl: invoice.hosted_invoice_url ?? `${WEB_URL}/billing`,
            actionLabel: 'Ver nota fiscal',
            metadata: { stripeInvoiceId: invoice.id, amountPaidCents: invoice.amount_paid },
            email: (email, name) =>
              sendInvoicePaidEmail(
                email,
                name,
                productName,
                invoice.hosted_invoice_url ?? `${WEB_URL}/billing`,
                invoice.amount_paid,
                invoice.currency,
                new Date(invoice.created * 1000),
              ),
          })

          const isNewOrRenewal = inv.billing_reason === 'subscription_cycle' || inv.billing_reason === 'subscription_create'
          if (isNewOrRenewal && subRow.planId) {
            const [planRow] = await db
              .select({ limits: productPlans.limits })
              .from(productPlans)
              .where(eq(productPlans.id, subRow.planId))
              .limit(1)

            let credits: number = (planRow?.limits as Record<string, number> | null)?.creditsPerCycle ?? 0
            if (credits > 0) {
              const addonRows = await db
                .select({ quantity: productSubscriptionAddons.quantity, limitsPerUnit: productAddonTypes.limitsPerUnit })
                .from(productSubscriptionAddons)
                .innerJoin(productAddonTypes, eq(productSubscriptionAddons.addonTypeId, productAddonTypes.id))
                .where(eq(productSubscriptionAddons.productSubscriptionId, subRow.id))
              for (const a of addonRows) {
                const perUnit = (a.limitsPerUnit as Record<string, number>)?.creditsPerCycle ?? 0
                credits += perUnit * a.quantity
              }
              await enqueue({ type: 'credits:grant', productSlug: subRow.productSlug, workspaceId: subRow.workspaceId, amount: credits })
            }
          }
        }
      }
    }
  }
}

export const billingRoutes = new Elysia()
  .use(authPlugin)

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

      let isMemberOfOrg = false
      if (row.organizationId) {
        const [membership] = await db
          .select()
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.organizationId, row.organizationId),
              eq(organizationMembers.userId, session.userId),
            ),
          )
          .limit(1)
        isMemberOfOrg = Boolean(membership)
      }

      if (row.ownerUserId !== session.userId && !isMemberOfOrg) {
        set.status = 404
        return { subscription: null }
      }

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

      const [subRow] = await db
        .select()
        .from(productSubscriptions)
        .where(
          and(
            eq(productSubscriptions.productSlug, body.product_slug),
            eq(productSubscriptions.workspaceId, body.workspace_id),
          ),
        )
        .limit(1)

      if (!subRow) {
        set.status = 404
        return { message: 'Workspace não encontrado.' }
      }

      if (subRow.ownerUserId !== session.userId) {
        set.status = 403
        return { message: 'Apenas o dono do workspace pode gerenciar a assinatura.' }
      }

      if (
        subRow.planId === plan.id &&
        subRow.status === 'active' &&
        !subRow.cancelAtPeriodEnd &&
        (plan.priceCents === 0 || hasActiveStripeSubscription(subRow))
      ) {
        set.status = 400
        return { message: 'Este já é o plano atual do workspace.' }
      }

      const stripe = getStripe()

      if (plan.priceCents === 0) {
        if (!subRow.freeEligible) {
          set.status = 403
          return { message: 'O plano grátis já foi usado por esta conta. Escolha um plano pago para este workspace.' }
        }

        if (hasActiveStripeSubscription(subRow)) {
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

          const productName = await getProductName(body.product_slug)
          const [currentPlan] = subRow.planId
            ? await db.select().from(productPlans).where(eq(productPlans.id, subRow.planId)).limit(1)
            : []
          await notifyBillingOwner(subRow, {
            title: 'Cancelamento agendado',
            body: `O plano ${currentPlan?.name ?? 'atual'} do ${productName} permanece ativo até ${periodEnd.toLocaleDateString('pt-BR')}. Depois disso, o workspace volta ao plano grátis.`,
            actionLabel: 'Retomar assinatura',
            metadata: { planName: currentPlan?.name ?? 'atual', periodEnd: periodEnd.toISOString() },
            email: (email, name) => sendCancelScheduledEmail(email, name, productName, currentPlan?.name ?? 'atual', periodEnd),
          })

          return { scheduled: true as const, effectiveAt: periodEnd.toISOString() }
        }

        await db
          .update(productSubscriptions)
          .set({ planId: plan.id, status: 'active', updatedAt: new Date() })
          .where(eq(productSubscriptions.id, subRow.id))

        await enqueue({
          type: 'entitlements:sync',
          productSlug: body.product_slug,
          workspaceId: body.workspace_id,
        })

        return { activated: true as const }
      }

      if (!plan.stripePriceId) {
        set.status = 503
        return { message: 'Preço deste plano não está configurado. Tente novamente mais tarde.' }
      }

      if (!stripe) {
        set.status = 503
        return { message: 'Stripe não configurado neste ambiente.' }
      }

      if (hasActiveStripeSubscription(subRow)) {
        const stripeSub = await stripe.subscriptions.retrieve(subRow.stripeSubscriptionId!)
        const baseItem = await findBasePlanItem(stripeSub, body.product_slug)

        const [currentPlanRow] = subRow.planId
          ? await db.select().from(productPlans).where(eq(productPlans.id, subRow.planId)).limit(1)
          : []
        const isUpgrade = (currentPlanRow?.priceCents ?? 0) < plan.priceCents

        const updateParams: Stripe.SubscriptionUpdateParams = {
          items: [
            baseItem
              ? { id: baseItem.id, price: plan.stripePriceId }
              : { price: plan.stripePriceId, quantity: 1 },
          ],
          ...(isUpgrade
            ? { billing_cycle_anchor: 'now', proration_behavior: 'none' }
            : { proration_behavior: 'always_invoice' }),
          cancel_at_period_end: false,
          metadata: { ...stripeSub.metadata, planId: plan.id },
        }
        console.log('[billing:upgrade] subscriptionId=%s params=%s', subRow.stripeSubscriptionId!, JSON.stringify(updateParams))
        const updatedSub = await stripe.subscriptions.update(subRow.stripeSubscriptionId!, updateParams)

        const latestInvoiceId =
          typeof updatedSub.latest_invoice === 'string'
            ? updatedSub.latest_invoice
            : updatedSub.latest_invoice?.id
        const latestInvoice = latestInvoiceId
          ? await stripe.invoices.retrieve(latestInvoiceId)
          : null
        if (latestInvoice?.status !== 'paid') {
          set.status = 402
          return { message: 'Pagamento do upgrade não foi aprovado. O plano atual não foi alterado.' }
        }

        const period = subscriptionPeriod(updatedSub)
        await db
          .update(productSubscriptions)
          .set({
            planId: plan.id,
            cancelAtPeriodEnd: false,
            status: updatedSub.status,
            ...(period.start ? { currentPeriodStart: period.start } : {}),
            ...(period.end ? { currentPeriodEnd: period.end } : {}),
            updatedAt: new Date(),
          })
          .where(eq(productSubscriptions.id, subRow.id))

        await enqueue({
          type: 'entitlements:sync',
          productSlug: body.product_slug,
          workspaceId: body.workspace_id,
        })

        const credits = (plan.limits.creditsPerCycle ?? 0)
        if (credits > 0) {
          await enqueue({
            type: 'credits:grant',
            productSlug: body.product_slug,
            workspaceId: body.workspace_id,
            amount: credits,
          })
        }

        const productName = await getProductName(body.product_slug)
        await notifyBillingOwner(subRow, {
          title: 'Plano alterado',
          body: `Seu plano no ${productName} agora é o ${plan.name}. A diferença de valor é ajustada proporcionalmente na próxima fatura.`,
          metadata: { planName: plan.name },
          email: (email, name) => sendPlanChangedEmail(email, name, productName, plan.name),
        })

        return { changed: true as const }
      }

      const customerId = await getOrCreateStripeCustomer(stripe, subRow.id)

      const checkout = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: plan.stripePriceId, quantity: 1 }],
        success_url: body.success_url ?? `${WEB_URL}/billing?success=true`,
        cancel_url: body.cancel_url ?? `${WEB_URL}/billing`,
        subscription_data: {
          metadata: {
            subscriptionRowId: subRow.id,
            productSlug: body.product_slug,
            workspaceId: body.workspace_id,
            planId: plan.id,
          },
        },
        metadata: {
          subscriptionRowId: subRow.id,
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
        success_url: t.Optional(t.String()),
        cancel_url: t.Optional(t.String()),
      }),
    },
  )

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
    await notifyBillingOwner(subRow, {
      title: 'Cancelamento agendado',
      body: `O plano ${plan?.name ?? 'atual'} do ${productName} permanece ativo até ${periodEnd.toLocaleDateString('pt-BR')}. Depois disso, o workspace volta ao plano grátis.`,
      actionLabel: 'Retomar assinatura',
      metadata: { planName: plan?.name ?? 'atual', periodEnd: periodEnd.toISOString() },
      email: (email, name) => sendCancelScheduledEmail(email, name, productName, plan?.name ?? 'atual', periodEnd),
    })

    return { scheduled: true as const, effectiveAt: periodEnd.toISOString() }
  })

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

      const [currentPlan] = subRow.planId
        ? await db.select().from(productPlans).where(eq(productPlans.id, subRow.planId)).limit(1)
        : []
      if (!currentPlan || currentPlan.priceCents === 0) {
        set.status = 400
        return { message: 'Add-ons não estão disponíveis no plano Grátis. Faça upgrade para usar add-ons.' }
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
        addonType.id,
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

      if (body.quantity > 0) {
        const [currentPlan] = subRow.planId
          ? await db.select().from(productPlans).where(eq(productPlans.id, subRow.planId)).limit(1)
          : []
        if (!currentPlan || currentPlan.priceCents === 0) {
          set.status = 400
          return { message: 'Add-ons não estão disponíveis no plano Grátis. Faça upgrade para usar add-ons.' }
        }
      }

      const stripe = getStripe()
      if (!stripe) {
        set.status = 503
        return { message: 'Stripe não configurado neste ambiente.' }
      }

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
            addonType.id,
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

  .post('/webhooks/stripe', async ({ request, set }) => {
    const stripe = getStripe()
    if (!stripe) {
      set.status = 503
      return { message: 'Stripe não configurado neste ambiente.' }
    }

    const webhookSecret = getOptionalSecret('STRIPE_WEBHOOK_SECRET')
    if (!webhookSecret) {
      set.status = 503
      return { message: 'Stripe webhook secret não configurado.' }
    }

    const sig = request.headers.get('stripe-signature')
    if (!sig) {
      set.status = 400
      return { message: 'Missing signature.' }
    }

    let event: Stripe.Event
    try {
      const rawBody = await request.text()
      event = await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret)
    } catch {
      set.status = 400
      return { message: 'Webhook signature verification failed.' }
    }

    const [claimed] = await db
      .insert(stripeWebhookEvents)
      .values({ id: generateId(), stripeEventId: event.id, type: event.type })
      .onConflictDoNothing({ target: stripeWebhookEvents.stripeEventId })
      .returning({ id: stripeWebhookEvents.id })

    if (!claimed) {
      return { received: true }
    }

    try {
      await handleStripeEvent(stripe, event)
    } catch (err) {
      await db.delete(stripeWebhookEvents).where(eq(stripeWebhookEvents.id, claimed.id))
      throw err
    }

    await db
      .update(stripeWebhookEvents)
      .set({ processedAt: new Date() })
      .where(eq(stripeWebhookEvents.id, claimed.id))
    return { received: true }
  })

  .post(
    '/internal/billing/ensure-free-subscription',
    async ({ request, body, set }) => {
      const headers: Record<string, string | undefined> = Object.fromEntries(request.headers.entries())
      if (!verifyInternalSecret(headers)) {
        set.status = 401
        return { message: 'Não autorizado.' }
      }

      try {
        const sub = await ensureFreeSubscription({
          productSlug: body.product_slug,
          workspaceId: body.workspace_id,
          workspaceName: body.workspace_name,
          ownerUserId: body.owner_user_id,
          organizationId: body.organization_id,
          freeEligible: body.free_eligible ?? true,
        })
        return { subscriptionId: sub.id, status: sub.status }
      } catch (err) {
        console.error('[billing:ensure-free-subscription] erro:', err)
        set.status = 500
        return { message: 'Erro ao garantir assinatura grátis.' }
      }
    },
    {
      body: t.Object({
        product_slug: t.String(),
        workspace_id: t.String(),
        workspace_name: t.Optional(t.String()),
        owner_user_id: t.String(),
        organization_id: t.Optional(t.Union([t.String(), t.Null()])),
        free_eligible: t.Optional(t.Boolean()),
      }),
    },
  )

  .post(
    '/internal/admin/billing/refunds',
    async ({ request, body, set }) => {
      const provided = request.headers.get('authorization')?.replace(/^Bearer /, '')
      if (!verifySecret(provided, INTERNAL_ADMIN_SECRET)) {
        set.status = 401
        return { message: 'Não autorizado.' }
      }

      const stripe = getStripe()
      if (!stripe) {
        set.status = 503
        return { message: 'Stripe não configurado neste ambiente.' }
      }

      const [subRow] = await db
        .select()
        .from(productSubscriptions)
        .where(eq(productSubscriptions.id, body.subscription_id))
        .limit(1)
      if (!subRow) {
        set.status = 404
        return { message: 'Assinatura não encontrada.' }
      }

      const invoice = await stripe.invoices.retrieve(body.invoice_id)
      const invoiceShape = invoice as Stripe.Invoice & {
        charge?: string | Stripe.Charge | null
        payment_intent?: string | Stripe.PaymentIntent | null
      }
      const invoiceSubId = typeof invoice.subscription === 'string'
        ? invoice.subscription
        : invoice.subscription?.id
      const belongsToSubscription =
        invoice.metadata?.subscriptionRowId === subRow.id ||
        invoiceSubId === subRow.stripeSubscriptionId
      if (!belongsToSubscription) {
        set.status = 400
        return { message: 'A fatura não pertence a esta assinatura.' }
      }

      let addonTypeId: string | undefined
      let addonQuantity: number | undefined
      let addonQuantityAfter: number | undefined
      let amount = 0
      if (body.scope === 'addon') {
        if (!body.addon_type_id || !body.quantity) {
          set.status = 400
          return { message: 'Add-on e quantidade são obrigatórios.' }
        }
        const [addon] = await db
          .select({ row: productSubscriptionAddons, type: productAddonTypes })
          .from(productSubscriptionAddons)
          .innerJoin(productAddonTypes, eq(productSubscriptionAddons.addonTypeId, productAddonTypes.id))
          .where(and(
            eq(productSubscriptionAddons.productSubscriptionId, subRow.id),
            eq(productSubscriptionAddons.addonTypeId, body.addon_type_id),
          ))
          .limit(1)
        if (!addon || body.quantity > addon.row.quantity) {
          set.status = 400
          return { message: 'Quantidade de add-on inválida para esta assinatura.' }
        }
        addonTypeId = addon.type.id
        addonQuantity = body.quantity
        addonQuantityAfter = addon.row.quantity - body.quantity
        amount = addon.type.priceCents * body.quantity
      }

      const chargeId = typeof invoiceShape.charge === 'string'
        ? invoiceShape.charge
        : invoiceShape.charge?.id
      const paymentIntentId = typeof invoiceShape.payment_intent === 'string'
        ? invoiceShape.payment_intent
        : invoiceShape.payment_intent?.id
      if (!chargeId && !paymentIntentId) {
        set.status = 400
        return { message: 'A fatura não possui uma cobrança reembolsável.' }
      }

      const charge = chargeId
        ? await stripe.charges.retrieve(chargeId)
        : await stripe.charges.list({ payment_intent: paymentIntentId!, limit: 1 }).then((r) => r.data[0])
      if (!charge) {
        set.status = 400
        return { message: 'A cobrança da fatura não foi encontrada.' }
      }
      const refundableAmount = charge.amount - charge.amount_refunded
      if (body.scope === 'subscription') amount = refundableAmount
      if (amount <= 0 || amount > refundableAmount) {
        set.status = 400
        return { message: 'O valor solicitado não está disponível para reembolso nesta cobrança.' }
      }

      const refund = await stripe.refunds.create({
        charge: charge.id,
        amount,
        reason: body.reason,
        metadata: {
          billingScope: body.scope,
          subscriptionRowId: subRow.id,
          productSlug: subRow.productSlug,
          workspaceId: subRow.workspaceId,
          ...(addonTypeId ? { addonTypeId } : {}),
          ...(addonQuantity ? { addonQuantity: String(addonQuantity) } : {}),
          ...(addonQuantityAfter !== undefined ? { addonQuantityAfter: String(addonQuantityAfter) } : {}),
        },
      })

      await db.insert(auditLogs).values({
        id: generateId(),
        action: 'billing.refund.created',
        resourceType: 'product_subscription',
        resourceId: subRow.id,
        metadata: {
          stripeRefundId: refund.id,
          stripeInvoiceId: invoice.id,
          scope: body.scope,
          amountCents: refund.amount,
          addonTypeId: addonTypeId ?? null,
          addonQuantity: addonQuantity ?? null,
        },
        ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        userAgent: request.headers.get('user-agent'),
      })

      return { refundId: refund.id, status: refund.status, amountCents: refund.amount }
    },
    {
      body: t.Object({
        subscription_id: t.String(),
        invoice_id: t.String(),
        scope: t.Union([t.Literal('subscription'), t.Literal('addon')]),
        addon_type_id: t.Optional(t.String()),
        quantity: t.Optional(t.Number({ minimum: 1 })),
        reason: t.Optional(t.Union([
          t.Literal('duplicate'),
          t.Literal('fraudulent'),
          t.Literal('requested_by_customer'),
        ])),
      }),
    },
  )
