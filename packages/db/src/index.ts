import Database from 'better-sqlite3'
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3'
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema' // Import all exports from schema.ts

// Determine APP_MODE, defaulting to 'online'
const appMode = process.env.APP_MODE || 'online'

// Determine DATABASE_TYPE based on APP_MODE, allowing explicit override
const databaseType = process.env.DATABASE_TYPE || (appMode === 'offline' ? 'sqlite' : 'postgres')

// Determine DATABASE_URL based on APP_MODE, allowing explicit override
let connectionString: string
if (process.env.DATABASE_URL) {
  connectionString = process.env.DATABASE_URL
} else {
  if (appMode === 'offline') {
    // Default for offline mode: local SQLite file
    connectionString = 'file:./data/keres.sqlite'
  } else {
    // Default for online mode: local PostgreSQL
    connectionString = 'postgres://user:password@localhost:5432/keres_db'
  }
}

let db: any // eslint-disable-line @typescript-eslint/no-explicit-any

console.log('Attempting to initialize Drizzle DB client...')
console.log(`Using app mode: ${appMode}`)
console.log(`Using database type: ${databaseType}`)
console.log(`Using connection string: ${connectionString}`)

if (databaseType === 'sqlite') {
  const sqlite = new Database(connectionString)
  db = drizzleSqlite(sqlite, { schema })
} else if (databaseType === 'postgres') { // Explicitly check for postgres
  const client = postgres(connectionString)
  db = drizzlePg(client, { schema })
} else {
  // Handle unsupported database types or throw an error
  throw new Error(`Unsupported database type: ${databaseType}`)
}

export { db } // Export db and pass schema

export * from './schema' // Re-export all named exports from schema.ts

