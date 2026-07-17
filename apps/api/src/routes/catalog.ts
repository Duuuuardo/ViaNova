import { Elysia } from 'elysia'
import { db, productCatalog, productPlans, productAddonTypes } from '@vianova/db'
import { eq, and, asc } from 'drizzle-orm'

// Campos públicos do catálogo — nunca expor oidc_client_secret_hash.
const publicProductFields = {
  slug: productCatalog.slug,
  name: productCatalog.name,
  domain: productCatalog.domain,
  description: productCatalog.description,
  icon: productCatalog.icon,
  webUrl: productCatalog.webUrl,
}

export const catalogRoutes = new Elysia({ prefix: '/products' })

  .get('/', async () => {
    const products = await db
      .select(publicProductFields)
      .from(productCatalog)
      .where(eq(productCatalog.isActive, true))

    return { products }
  })

  .get('/:slug/plans', async ({ params, set }) => {
    const [product] = await db
      .select(publicProductFields)
      .from(productCatalog)
      .where(and(eq(productCatalog.slug, params.slug), eq(productCatalog.isActive, true)))
      .limit(1)

    if (!product) {
      set.status = 404
      return { message: 'Produto não encontrado.' }
    }

    const plans = await db
      .select({
        id: productPlans.id,
        tier: productPlans.tier,
        name: productPlans.name,
        description: productPlans.description,
        priceCents: productPlans.priceCents,
        limits: productPlans.limits,
        sortOrder: productPlans.sortOrder,
      })
      .from(productPlans)
      .where(and(eq(productPlans.productSlug, params.slug), eq(productPlans.isActive, true)))
      .orderBy(asc(productPlans.sortOrder))

    const addons = await db
      .select({
        id: productAddonTypes.id,
        key: productAddonTypes.key,
        name: productAddonTypes.name,
        description: productAddonTypes.description,
        unitLabel: productAddonTypes.unitLabel,
        priceCents: productAddonTypes.priceCents,
        limitsPerUnit: productAddonTypes.limitsPerUnit,
      })
      .from(productAddonTypes)
      .where(and(eq(productAddonTypes.productSlug, params.slug), eq(productAddonTypes.isActive, true)))

    const sanitizedPlans = plans.map((p) => {
      if (params.slug === 'naia' && p.tier === 'free') {
        return {
          ...p,
          limits: { ...p.limits, messagesPerMonth: 3, campaignsPerMonth: 1 },
        }
      }
      return p
    })

    return { product, plans: sanitizedPlans, addons }
  })
