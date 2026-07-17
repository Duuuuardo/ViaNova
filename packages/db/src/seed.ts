import { db } from './index'
import { productCatalog, productPlans, productAddonTypes } from './schema'

function hashSecret(secret: string): string {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(secret)
  return hasher.digest('hex')
}

// Secret OIDC de dev do produto naia — em produção, gerar e distribuir fora do seed.
const NAIA_DEV_CLIENT_SECRET = process.env.NAIA_OIDC_CLIENT_SECRET ?? 'naia-dev-secret'

async function seed() {
  await db
    .insert(productCatalog)
    .values({
      slug: 'naia',
      name: 'Naia Campanhas',
      domain: 'naia.website',
      description: 'Campanhas — disparo de mensagens em massa via Telegram e WhatsApp.',
      icon: 'naia',
      webUrl: process.env.NAIA_WEB_URL ?? 'http://localhost:3001',
      apiUrl: process.env.NAIA_API_URL ?? 'http://localhost:4001',
      oidcClientSecretHash: hashSecret(NAIA_DEV_CLIENT_SECRET),
      redirectUris: [
        'http://localhost:3001/auth/callback',
        // Cliente OIDC de teste do Milestone 1 (scripts/mock-oidc-client.ts)
        'http://localhost:9999/callback',
      ],
    })
    .onConflictDoUpdate({
      target: productCatalog.slug,
      set: {
        name: 'Naia Campanhas',
        domain: 'naia.website',
        oidcClientSecretHash: hashSecret(NAIA_DEV_CLIENT_SECRET),
        redirectUris: ['http://localhost:3001/auth/callback', 'http://localhost:9999/callback'],
      },
    })

  const plans = [
    {
      id: 'naia-free',
      productSlug: 'naia',
      tier: 'free',
      name: 'Grátis',
      description: 'Para experimentar o Naia.',
      priceCents: 0,
      stripePriceId: process.env.NAIA_STRIPE_PRICE_FREE ?? null,
      limits: { seats: 1, connections: 1, messagesPerMonth: 3, campaignsPerMonth: 1 },
      sortOrder: 0,
    },
    {
      id: 'naia-starter',
      productSlug: 'naia',
      tier: 'starter',
      name: 'Starter',
      description: 'Para operações pequenas.',
      priceCents: 9700,
      stripePriceId: process.env.NAIA_STRIPE_PRICE_STARTER ?? null,
      limits: { seats: 3, connections: 2, messagesPerMonth: 5000, campaignsPerMonth: 20 },
      sortOrder: 1,
    },
    {
      id: 'naia-pro',
      productSlug: 'naia',
      tier: 'pro',
      name: 'Pro',
      description: 'Para times que disparam em escala.',
      priceCents: 24700,
      stripePriceId: process.env.NAIA_STRIPE_PRICE_PRO ?? null,
      limits: { seats: 10, connections: 5, messagesPerMonth: 50000, campaignsPerMonth: 100 },
      sortOrder: 2,
    },
  ]

  for (const plan of plans) {
    // Re-runs não zeram o stripePriceId gravado pelo bootstrap do Stripe.
    const { stripePriceId, ...rest } = plan
    await db
      .insert(productPlans)
      .values(plan)
      .onConflictDoUpdate({
        target: productPlans.id,
        set: stripePriceId ? plan : rest,
      })
  }

  const addons = [
    {
      id: 'naia-extra-campaigns',
      productSlug: 'naia',
      key: 'extra_campaigns',
      name: 'Campanhas extras',
      description: 'Pacote de 10 campanhas adicionais por mês.',
      unitLabel: 'pacote de 10 campanhas',
      priceCents: 4700,
      stripePriceId: process.env.NAIA_STRIPE_PRICE_EXTRA_CAMPAIGNS ?? null,
      limitsPerUnit: { campaignsPerMonth: 10 },
    },
    {
      id: 'naia-extra-seats',
      productSlug: 'naia',
      key: 'extra_seats',
      name: 'Assentos extras',
      description: 'Um assento adicional para convidar mais um membro ao workspace.',
      unitLabel: 'assento',
      priceCents: 1900,
      stripePriceId: process.env.NAIA_STRIPE_PRICE_EXTRA_SEATS ?? null,
      limitsPerUnit: { seats: 1 },
    },
  ]

  for (const addon of addons) {
    const { stripePriceId, ...rest } = addon
    await db
      .insert(productAddonTypes)
      .values(addon)
      .onConflictDoUpdate({
        target: productAddonTypes.id,
        set: stripePriceId ? addon : rest,
      })
  }

  console.log('Seed concluído: produto naia + planos + add-ons.')
  process.exit(0)
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
