import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema' // Import all exports from schema.ts

const connectionString =
  process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/keres_db'

console.log('Attempting to initialize Drizzle DB client...')
console.log(`Using connection string: ${connectionString}`)

const client = postgres(connectionString)
export const db = drizzle(client, { schema }) // Export db and pass schema

export * from './schema' // Re-export all named exports from schema.ts

console.log('Drizzle DB client initialized.')
