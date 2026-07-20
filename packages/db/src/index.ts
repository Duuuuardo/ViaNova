import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.VIANOVA_DATABASE_URL
if (!connectionString || connectionString.trim().length === 0) {
  throw new Error('[vianova/db] VIANOVA_DATABASE_URL is required')
}

const client = postgres(connectionString)
export const db = drizzle(client, { schema })

export * from './schema'
export { schema }
