import { syncEntitlements } from '../src/lib/product-sync'

// Re-executa o sync de entitlements de um workspace (útil quando o produto
// estava offline no momento do webhook).
// Uso: bun --env-file ../../.env scripts/resync-entitlements.ts <productSlug> <workspaceId>

const [productSlug, workspaceId] = process.argv.slice(2)
if (!productSlug || !workspaceId) {
  console.error('uso: resync-entitlements.ts <productSlug> <workspaceId>')
  process.exit(1)
}

await syncEntitlements(productSlug, workspaceId)
console.log(`sync ok: ${productSlug}/${workspaceId}`)
process.exit(0)
