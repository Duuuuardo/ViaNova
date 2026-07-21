import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { users } from './users'
import { sessions } from './auth'
import { productCatalog } from './catalog'

// Códigos do Authorization Code flow. Uso único, TTL curto.
export const oidcAuthCodes = pgTable('oidc_auth_codes', {
  id: text('id').primaryKey(),
  codeHash: text('code_hash').notNull().unique(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  clientSlug: text('client_slug').notNull().references(() => productCatalog.slug),
  redirectUri: text('redirect_uri').notNull(),
  scope: text('scope').notNull().default('openid'),
  nonce: text('nonce'),
  // PKCE (RFC 7636): challenge enviado no /authorize, verificado contra o
  // code_verifier no /token. Nulo para clientes legados que não usam PKCE.
  codeChallenge: text('code_challenge'),
  codeChallengeMethod: text('code_challenge_method'),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Par de chaves de assinatura (RS256). Gerado no primeiro boot; a pública é
// exposta via /.well-known/jwks.json.
export const oidcKeys = pgTable('oidc_keys', {
  id: text('id').primaryKey(),
  kid: text('kid').notNull().unique(),
  alg: text('alg').notNull().default('RS256'),
  privatePem: text('private_pem').notNull(),
  publicJwk: jsonb('public_jwk').$type<Record<string, unknown>>().notNull(),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Auditoria de tokens de serviço emitidos (Vianova → produto).
export const serviceTokens = pgTable('service_tokens', {
  id: text('id').primaryKey(),
  jti: text('jti').notNull().unique(),
  productSlug: text('product_slug').notNull().references(() => productCatalog.slug),
  scope: text('scope').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Refresh tokens OIDC. Opacos, rotacionados a cada uso.
// O `sid` amarra o refresh token à sessão do Vianova: quando a sessão cai
// (logout ou expiração), todos os refresh tokens associados são deletados via
// ON DELETE CASCADE — nenhum produto consegue renovar um acesso já revogado.
export const oidcRefreshTokens = pgTable('oidc_refresh_tokens', {
  id: text('id').primaryKey(),
  tokenHash: text('token_hash').notNull().unique(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  clientSlug: text('client_slug').notNull().references(() => productCatalog.slug),
  usedAt: timestamp('used_at'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type OidcAuthCode = typeof oidcAuthCodes.$inferSelect
export type OidcKey = typeof oidcKeys.$inferSelect
export type ServiceToken = typeof serviceTokens.$inferSelect
export type OidcRefreshToken = typeof oidcRefreshTokens.$inferSelect
