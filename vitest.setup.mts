import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll } from 'vitest'

import * as schema from './packages/db/src/schema'

const client = postgres(
  process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/keres_db',
)
export const db = drizzle(client, { schema })

beforeAll(async () => {
  console.log('Attempting to initialize Drizzle DB client...')
  // Ensure the database client is initialized before tests run
  // This might involve connecting to a test database or ensuring migrations are run
  // For now, we just log that it's being initialized.
  console.log('Drizzle DB client initialized.')
})

afterAll(async () => {
  console.log('Tests finished. No specific cleanup for Drizzle client needed here.')
})
