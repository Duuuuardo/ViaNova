import { syncEntitlements } from '../src/lib/product-sync'


const [productSlug, workspaceId] = process.argv.slice(2)
if (!productSlug || !workspaceId) {
  console.error('uso: resync-entitlements.ts <productSlug> <workspaceId>')
  process.exit(1)
}

await syncEntitlements(productSlug, workspaceId)
console.log(`sync ok: ${productSlug}/${workspaceId}`)
process.exit(0)
