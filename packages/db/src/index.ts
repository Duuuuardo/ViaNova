import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const client = postgres(
  process.env.VIANOVA_DATABASE_URL ?? 'postgres://vianova:vianova_secret@localhost:5434/vianova',
)
export const db = drizzle(client, { schema })

export * from './schema'
export { schema }
