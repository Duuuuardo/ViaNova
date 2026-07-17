import Stripe from 'stripe'
import { db, productPlans, productAddonTypes } from '@vianova/db'
import { eq, gt, and } from 'drizzle-orm'

// Garante que todo plano/add-on pago do catálogo tenha um price recorrente no
// Stripe e grava o stripe_price_id de volta no banco. Idempotente: usa o id do
// catálogo como lookup_key do price — re-rodar não duplica nada.
//
// Uso: bun --env-file ../../.env scripts/stripe-bootstrap.ts

const key = process.env.STRIPE_SECRET_KEY
if (!key) {
  console.error('STRIPE_SECRET_KEY não configurada.')
  process.exit(1)
}
if (!key.startsWith('sk_test_')) {
  console.error('Este bootstrap só roda com chave de teste (sk_test_).')
  process.exit(1)
}

const stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia' })

async function ensurePrice(opts: {
  lookupKey: string
  productName: string
  amountCents: number
  metadata: Record<string, string>
}): Promise<string> {
  const existing = await stripe.prices.list({ lookup_keys: [opts.lookupKey], limit: 1 })
  if (existing.data[0]) return existing.data[0].id

  const product = await stripe.products.create({
    name: opts.productName,
    metadata: opts.metadata,
  })
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: opts.amountCents,
    currency: 'brl',
    recurring: { interval: 'month' },
    lookup_key: opts.lookupKey,
    metadata: opts.metadata,
  })
  return price.id
}

const plans = await db
  .select()
  .from(productPlans)
  .where(and(gt(productPlans.priceCents, 0), eq(productPlans.isActive, true)))

for (const plan of plans) {
  const priceId = await ensurePrice({
    lookupKey: plan.id,
    productName: `${plan.productSlug} — Plano ${plan.name}`,
    amountCents: plan.priceCents,
    metadata: { catalogType: 'plan', catalogId: plan.id, productSlug: plan.productSlug },
  })
  if (plan.stripePriceId !== priceId) {
    await db.update(productPlans).set({ stripePriceId: priceId }).where(eq(productPlans.id, plan.id))
  }
  console.log(`plano ${plan.id} → ${priceId}`)
}

const addons = await db
  .select()
  .from(productAddonTypes)
  .where(and(gt(productAddonTypes.priceCents, 0), eq(productAddonTypes.isActive, true)))

for (const addon of addons) {
  const priceId = await ensurePrice({
    lookupKey: addon.id,
    productName: `${addon.productSlug} — Add-on ${addon.name}`,
    amountCents: addon.priceCents,
    metadata: { catalogType: 'addon', catalogId: addon.id, productSlug: addon.productSlug },
  })
  if (addon.stripePriceId !== priceId) {
    await db.update(productAddonTypes).set({ stripePriceId: priceId }).where(eq(productAddonTypes.id, addon.id))
  }
  console.log(`add-on ${addon.id} → ${priceId}`)
}

console.log('Bootstrap do Stripe concluído.')
process.exit(0)
