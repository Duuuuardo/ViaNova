import { pgTable, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  // Moldura do avatar escolhida pelo usuário na conta: none | via | gradient.
  avatarFrame: text('avatar_frame').notNull().default('none'),
  phone: text('phone'),
  jobTitle: text('job_title'),
  department: text('department'),
  location: text('location'),
  timezone: text('timezone').notNull().default('America/Sao_Paulo'),
  locale: text('locale').notNull().default('pt-BR'),
  preferences: jsonb('preferences')
    .$type<{
      theme?: 'system' | 'light' | 'dark'
      reducedMotion?: boolean
      billingAlerts?: boolean
      securityAlerts?: boolean
      marketingEmails?: boolean
    }>()
    .notNull()
    .default({
      theme: 'system',
      reducedMotion: false,
      billingAlerts: true,
      securityAlerts: true,
      marketingEmails: false,
    }),
  emailVerifiedAt: timestamp('email_verified_at'),
  twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
  scheduledForDeletionAt: timestamp('scheduled_for_deletion_at'),
  status: text('status').notNull().default('active'),
  role: text('role').$type<'user' | 'admin' | 'superadmin'>().notNull().default('user'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
