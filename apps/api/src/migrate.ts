import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const url = process.env.VIANOVA_DATABASE_URL
if (!url) {
  console.error('[migrate] VIANOVA_DATABASE_URL not set')
  process.exit(1)
}

const client = postgres(url, { max: 1 })
const db = drizzle(client)

await migrate(db, { migrationsFolder: './drizzle' })
console.log('[migrate] Done')
await client.end()
