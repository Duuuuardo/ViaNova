import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.VIANOVA_DATABASE_URL ?? 'postgres://vianova:vianova_secret@localhost:5434/vianova',
  },
})
