import Database from 'better-sqlite3'
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3'
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema' // Import all exports from schema.ts

const databaseType = process.env.DATABASE_TYPE || 'postgres'
const connectionString =
  process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/keres_db'

let db: any // eslint-disable-line @typescript-eslint/no-explicit-any

console.log('Attempting to initialize Drizzle DB client...')
console.log(`Using database type: ${databaseType}`)
console.log(`Using connection string: ${connectionString}`)

if (databaseType === 'sqlite') {
  const sqlite = new Database(connectionString)
  db = drizzleSqlite(sqlite, { schema })
} else {
  const client = postgres(connectionString)
  db = drizzlePg(client, { schema })
}

export { db } // Export db and pass schema

export * from './schema' // Re-export all named exports from schema.ts

console.log('Drizzle DB client initialized.')
