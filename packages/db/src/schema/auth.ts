import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { users } from './users'

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ip: text('ip'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Identifica um navegador confiável por um cookie aleatório e revogável. O token
// nunca é persistido em claro; limpar os cookies faz o próximo acesso ser tratado
// como um novo dispositivo.
export const loginDevices = pgTable(
  'login_devices',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    lastIp: text('last_ip'),
    lastUserAgent: text('last_user_agent'),
    lastLocationKey: text('last_location_key'),
    firstSeenAt: timestamp('first_seen_at').defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('login_devices_user_token_hash_idx').on(t.userId, t.tokenHash)],
)

export const emailVerifications = pgTable('email_verifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const passwordResets = pgTable('password_resets', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const totpSecrets = pgTable('totp_secrets', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  secret: text('secret').notNull(),
  backupCodes: text('backup_codes').array(),
  verifiedAt: timestamp('verified_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Token temporário usado no fluxo de 2FA: a senha é validada na primeira
// requisição, mas a sessão só é criada após o TOTP. Evita armazenar
// credenciais no sessionStorage do navegador.
export const loginChallenges = pgTable('login_challenges', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  ip: text('ip'),
  userAgent: text('user_agent'),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type Session = typeof sessions.$inferSelect
export type LoginDevice = typeof loginDevices.$inferSelect
export type EmailVerification = typeof emailVerifications.$inferSelect
export type PasswordReset = typeof passwordResets.$inferSelect
export type TotpSecret = typeof totpSecrets.$inferSelect
export type LoginChallenge = typeof loginChallenges.$inferSelect
