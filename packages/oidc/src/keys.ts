import { db, oidcKeys } from '@vianova/db'
import { isNull } from 'drizzle-orm'
import {
  generateKeyPair,
  exportPKCS8,
  exportJWK,
  importPKCS8,
  calculateJwkThumbprint,
  type JWK,
} from 'jose'

const ALG = 'RS256'

let cachedKey: { kid: string; privateKey: CryptoKey } | null = null

export async function getSigningKey(): Promise<{ kid: string; privateKey: CryptoKey }> {
  if (cachedKey) return cachedKey

  const [existing] = await db.select().from(oidcKeys).where(isNull(oidcKeys.revokedAt)).limit(1)

  if (existing) {
    const privateKey = await importPKCS8(existing.privatePem, ALG)
    cachedKey = { kid: existing.kid, privateKey }
    return cachedKey
  }

  const { publicKey, privateKey } = await generateKeyPair(ALG, { extractable: true })
  const publicJwk = await exportJWK(publicKey)
  const kid = await calculateJwkThumbprint(publicJwk)
  publicJwk.kid = kid
  publicJwk.alg = ALG
  publicJwk.use = 'sig'

  const privatePem = await exportPKCS8(privateKey)

  await db.insert(oidcKeys).values({
    id: crypto.randomUUID(),
    kid,
    alg: ALG,
    privatePem,
    publicJwk: publicJwk as Record<string, unknown>,
  })

  cachedKey = { kid, privateKey }
  return cachedKey
}

export async function getJwks(): Promise<{ keys: JWK[] }> {
  await getSigningKey()
  const rows = await db.select().from(oidcKeys)
  return { keys: rows.map((r) => r.publicJwk as JWK) }
}

export { ALG }
