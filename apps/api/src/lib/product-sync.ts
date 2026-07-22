import { db, productCatalog, productSubscriptions, productSubscriptionAddons, productPlans, productAddonTypes } from '@vianova/db'
import { eq, and } from 'drizzle-orm'
import { signServiceToken } from '@vianova/oidc'

// Canal service-to-service Vianova → produto. O produto é quem escreve o
// entitlement no próprio banco — o Vianova só empurra o estado consolidado.

async function getProduct(slug: string) {
  const [product] = await db
    .select()
    .from(productCatalog)
    .where(eq(productCatalog.slug, slug))
    .limit(1)
  return product ?? null
}

async function postToProduct<T = unknown>(
  apiUrl: string,
  path: string,
  scope: string,
  productSlug: string,
  body: unknown,
): Promise<{ ok: false; status: number; data?: unknown } | { ok: true; data: T }> {
  const { token } = await signServiceToken(productSlug, scope)

  let res: Response
  try {
    res = await fetch(`${apiUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    // Milestone 1: nenhum produto expõe esses endpoints ainda — indisponível
    // não é erro fatal, só registra. Quando o produto existir, 5xx abaixo
    // aciona o retry da fila normalmente.
    console.warn(`[product-sync] ${productSlug} indisponível em ${apiUrl}${path} (stub M1)`)
    return { ok: false, status: 503 }
  }

  // 4xx = o produto não implementa/reconhece o endpoint — retry não resolve.
  // 5xx = falha transitória, deixa a fila re-tentar.
  if (res.status >= 500) {
    throw new Error(`[product-sync] ${productSlug}${path} respondeu ${res.status}`)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.warn(`[product-sync] ${productSlug}${path} respondeu ${res.status} — sem retry`)
    return { ok: false, status: res.status, data: text }
  }

  const data = (await res.json().catch(() => ({}))) as T
  return { ok: true, data }
}

async function patchToProduct<T = unknown>(
  apiUrl: string,
  path: string,
  scope: string,
  productSlug: string,
  body: unknown,
): Promise<{ ok: false; status: number; data?: unknown } | { ok: true; data: T }> {
  const { token } = await signServiceToken(productSlug, scope)

  let res: Response
  try {
    res = await fetch(`${apiUrl}${path}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    console.warn(`[product-sync] ${productSlug} indisponível em ${apiUrl}${path}:`, err)
    return { ok: false, status: 503 }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { ok: false, status: res.status, data: text }
  }

  const data = (await res.json().catch(() => ({}))) as T
  return { ok: true, data }
}

export { patchToProduct, postToProduct }

export async function getFromProduct<T = unknown>(
  apiUrl: string,
  path: string,
  scope: string,
  productSlug: string,
): Promise<{ ok: false; status: number; data?: unknown } | { ok: true; data: T }> {
  const { token } = await signServiceToken(productSlug, scope)

  let res: Response
  try {
    res = await fetch(`${apiUrl}${path}`, {
      method: 'GET',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
    })
  } catch (err) {
    console.warn(`[product-sync] ${productSlug} indisponível em ${apiUrl}${path}:`, err)
    return { ok: false, status: 503 }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { ok: false, status: res.status, data: text }
  }

  const data = (await res.json().catch(() => ({}))) as T
  return { ok: true, data }
}

// Consolida plano + add-ons da assinatura de um workspace.
// Exportado para reutilização em quota de arquivos.
export async function resolveWorkspaceLimits(
  productSlug: string,
  workspaceId: string,
): Promise<{ tier: string; status: string; limits: Record<string, number> } | null> {
  const [sub] = await db
    .select({ sub: productSubscriptions, plan: productPlans })
    .from(productSubscriptions)
    .leftJoin(productPlans, eq(productSubscriptions.planId, productPlans.id))
    .where(
      and(
        eq(productSubscriptions.productSlug, productSlug),
        eq(productSubscriptions.workspaceId, workspaceId),
      ),
    )
    .limit(1)

  const active = sub && sub.sub.status === 'active' && sub.plan
  const limits: Record<string, number> = active ? { ...sub.plan!.limits } : {}
  const tier = active ? sub.plan!.tier : 'none'

  if (active) {
    const addons = await db
      .select({ addon: productSubscriptionAddons, type: productAddonTypes })
      .from(productSubscriptionAddons)
      .innerJoin(productAddonTypes, eq(productSubscriptionAddons.addonTypeId, productAddonTypes.id))
      .where(eq(productSubscriptionAddons.productSubscriptionId, sub.sub.id))

    for (const { addon, type } of addons) {
      for (const [key, perUnit] of Object.entries(type.limitsPerUnit)) {
        limits[key] = (limits[key] ?? 0) + perUnit * addon.quantity
      }
    }
  }

  if (tier === 'free' && productSlug === 'naia') {
    limits.creditsPerCycle = 3
    limits.campaignsPerMonth = 1
  }

  return {
    tier,
    status: sub?.sub.status ?? 'none',
    limits,
  }
}

// Consolida plano + add-ons da assinatura e sincroniza no produto via
// POST {product.api_url}/internal/entitlements.
export async function syncEntitlements(productSlug: string, workspaceId: string) {
  const product = await getProduct(productSlug)
  if (!product) throw new Error(`Produto ${productSlug} não existe no catálogo`)

  const resolved = await resolveWorkspaceLimits(productSlug, workspaceId)
  if (!resolved) return

  await postToProduct(product.apiUrl, '/internal/entitlements', 'service:entitlements:write', productSlug, {
    workspace_id: workspaceId,
    product_slug: productSlug,
    tier: resolved.tier,
    status: resolved.status,
    limits: resolved.limits,
  })
}

// Concede créditos de disparo ao workspace do produto após pagamento.
// Chamado em invoice.paid para subscription_create e subscription_cycle.
export async function grantCredits(productSlug: string, workspaceId: string, amount: number) {
  const product = await getProduct(productSlug)
  if (!product) return
  await postToProduct(product.apiUrl, '/internal/credits/grant', 'service:entitlements:write', productSlug, {
    workspace_id: workspaceId,
    product_slug: productSlug,
    amount,
  })
}

// Zera o saldo de créditos do workspace em estorno, chargeback ou cancelamento
// de subscription paga. Quem concede pode resetar.
export async function resetCredits(productSlug: string, workspaceId: string) {
  const product = await getProduct(productSlug)
  if (!product) return
  await postToProduct(product.apiUrl, '/internal/credits/reset', 'service:entitlements:write', productSlug, {
    workspace_id: workspaceId,
    product_slug: productSlug,
  })
}

// Single sign-out: avisa todos os produtos ativos que as sessões caíram.
// Complementa a introspection síncrona (produtos também consultam
// POST /oidc/introspect em pontos sensíveis).
export async function notifySessionRevoked(userId: string, sessionIds: string[]) {
  const products = await db
    .select()
    .from(productCatalog)
    .where(eq(productCatalog.isActive, true))

  for (const product of products) {
    // Um produto indisponível não pode impedir a revogação nos demais.
    try {
      await postToProduct(product.apiUrl, '/internal/session-revoked', 'service:sessions:revoke', product.slug, {
        user_id: userId,
        session_ids: sessionIds,
      })
    } catch (err) {
      console.error(`[product-sync] falha ao revogar sessões em ${product.slug}:`, err)
    }
  }
}
