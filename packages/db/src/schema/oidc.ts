import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { users } from './users'
import { sessions } from './auth'
import { productCatalog } from './catalog'

export const oidcAuthCodes = pgTable('oidc_auth_codes', {
  id: text('id').primaryKey(),
  codeHash: text('code_hash').notNull().unique(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  clientSlug: text('client_slug').notNull().references(() => productCatalog.slug),
  redirectUri: text('redirect_uri').notNull(),
  scope: text('scope').notNull().default('openid'),
  nonce: text('nonce'),
  codeChallenge: text('code_challenge'),
  codeChallengeMethod: text('code_challenge_method'),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const oidcKeys = pgTable('oidc_keys', {
  id: text('id').primaryKey(),
  kid: text('kid').notNull().unique(),
  alg: text('alg').notNull().default('RS256'),
  privatePem: text('private_pem').notNull(),
  publicJwk: jsonb('public_jwk').$type<Record<string, unknown>>().notNull(),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const serviceTokens = pgTable('service_tokens', {
  id: text('id').primaryKey(),
  jti: text('jti').notNull().unique(),
  productSlug: text('product_slug').notNull().references(() => productCatalog.slug),
  scope: text('scope').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

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
