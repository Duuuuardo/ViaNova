import { createHmac } from 'node:crypto'
import { db } from './index'
import { productCatalog, productPlans, productAddonTypes } from './schema'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.trim().length === 0) {
    console.error(`[seed] Environment variable ${name} is required`)
    process.exit(1)
  }
  return value
}

function hashSecret(secret: string): string {
  return createHmac('sha256', requireEnv('TOKEN_HASH_SALT')).update(secret).digest('hex')
}

// Secret OIDC de dev do produto naia — em produção, gerar e distribuir fora do seed.
const NAIA_DEV_CLIENT_SECRET = requireEnv('NAIA_OIDC_CLIENT_SECRET')

async function seed() {
  await db
    .insert(productCatalog)
    .values({
      slug: 'naia',
      name: 'Naia Campanhas',
      domain: 'naia.website',
      description: 'Campanhas — disparo de mensagens em massa via Telegram e WhatsApp.',
      icon: 'naia',
      webUrl: requireEnv('NAIA_WEB_URL'),
      apiUrl: requireEnv('NAIA_API_URL'),
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
      limits: { seats: 1, connections: 1, creditsPerCycle: 3, campaignsPerMonth: 1, automations: 0, storageBytes: 104_857_600, maxFileSizeBytes: 5_242_880 },
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
      limits: { seats: 1, connections: 2, creditsPerCycle: 3000, campaignsPerMonth: 10, automations: 0, storageBytes: 536_870_912, maxFileSizeBytes: 31_457_280 },
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
      limits: { seats: 10, connections: 5, creditsPerCycle: 50000, campaignsPerMonth: 100, automations: 2, storageBytes: 2_147_483_648, maxFileSizeBytes: 104_857_600 },
      sortOrder: 2,
    },
    {
      id: 'naia-scale',
      productSlug: 'naia',
      tier: 'scale',
      name: 'Scale',
      description: 'Para operações de alto volume com fila dedicada.',
      priceCents: 99700,
      stripePriceId: process.env.NAIA_STRIPE_PRICE_SCALE ?? null,
      limits: { seats: 50, connections: 20, creditsPerCycle: 500000, campaignsPerMonth: 1000, automations: -1, storageBytes: 10_737_418_240, maxFileSizeBytes: 524_288_000 },
      sortOrder: 3,
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

  const addons: Array<{
    id: string
    productSlug: string
    key: string
    name: string
    description: string
    unitLabel: string
    priceCents: number
    stripePriceId: string | null
    limitsPerUnit: Record<string, number>
  }> = [
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
      id: 'naia-extra-credits',
      productSlug: 'naia',
      key: 'extra_credits',
      name: 'Créditos extras',
      description: 'Pacote de 1.000 créditos de disparo adicionais.',
      unitLabel: 'pacote de 1.000 créditos',
      priceCents: 1900,
      stripePriceId: process.env.NAIA_STRIPE_PRICE_EXTRA_CREDITS ?? null,
      limitsPerUnit: { creditsPerCycle: 1000 },
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
    {
      id: 'naia-extra-connections',
      productSlug: 'naia',
      key: 'extra_connections',
      name: 'Conexões extras',
      description: 'Um canal adicional para conectar mais números de WhatsApp ou bots do Telegram.',
      unitLabel: 'conexão',
      priceCents: 3900,
      stripePriceId: process.env.NAIA_STRIPE_PRICE_EXTRA_CONNECTIONS ?? null,
      limitsPerUnit: { connections: 1 },
    },
    {
      id: 'naia-extra-automations',
      productSlug: 'naia',
      key: 'extra_automations',
      name: 'Automações extras',
      description: 'Uma automação ativa adicional para o seu workspace.',
      unitLabel: 'automação',
      priceCents: 1990,
      stripePriceId: process.env.NAIA_STRIPE_PRICE_EXTRA_AUTOMATIONS ?? null,
      limitsPerUnit: { automations: 1 },
    },
    {
      id: 'naia-extra-storage',
      productSlug: 'naia',
      key: 'extra_storage',
      name: 'Storage extra',
      description: 'Pacote de 1 GB de armazenamento adicional para mídias e arquivos do workspace.',
      unitLabel: 'GB',
      priceCents: 500,
      stripePriceId: process.env.NAIA_STRIPE_PRICE_EXTRA_STORAGE ?? null,
      limitsPerUnit: { storageBytes: 1_073_741_824 },
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
