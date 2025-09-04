import type { Config } from 'drizzle-kit'

const databaseType = process.env.DATABASE_TYPE || 'postgres'

const config: Config = {
  schema: './src/schema.ts',
  out: './migrations',
  driver: databaseType === 'sqlite' ? 'better-sqlite3' : 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL ?? '',
  },
}

export default config
