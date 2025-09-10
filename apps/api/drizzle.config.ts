import type { Config } from 'drizzle-kit'

const databaseType = process.env.DATABASE_TYPE || 'postgres'

const config: Config = {
  schema: './src/infrastructure/db/schema.ts',
  out: './src/infrastructure/db/migrations',
  driver: databaseType === 'sqlite' ? 'better-sqlite3' : 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL ?? '',
  },
}

export default config
