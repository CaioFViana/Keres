/**
 * SQLite access layer: the Drizzle client singleton plus the React context that serves it.
 *
 * The native database is opened once at startup; `initializeDrizzle` wraps it here and
 * everything below reads it back via `useDrizzle` (components) or the `db` export
 * (services). `resetDatabase` drops every table and clears the singleton, so the next
 * launch must re-run migrations and re-initialize before touching the database again.
 */
import { drizzle } from 'drizzle-orm/expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { createContext, useContext } from 'react';
import * as schema from './schema';

/** Module-level singleton. Null until `initializeDrizzle` runs, and after `resetDatabase`. */
export let db: AppDrizzleClient | null = null;

export type AppDrizzleClient = ReturnType<typeof drizzle<typeof schema>>;

export type AppDrizzleTransaction = Parameters<Parameters<AppDrizzleClient['transaction']>[0]>[0];

export const DrizzleContext = createContext<AppDrizzleClient | null>(null);

export const useDrizzle = () => {
  const context = useContext(DrizzleContext);
  if (context === null) {
    throw new Error('useDrizzle must be used within a DrizzleProvider');
  }
  return context;
};

export function initializeDrizzle(dbInstance: SQLiteDatabase) {
  // Idempotent: the database is opened once, so a repeat call must not re-wrap it.
  if (!db) {
    db = drizzle(dbInstance, { schema });
  }
  return db;
}

export async function resetDatabase(dbInstance: SQLiteDatabase) {
  console.log('Resetting database...');
  const tableNamesResult = await dbInstance.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';",
  );
  const tableNames = tableNamesResult.map((row) => row.name);

  for (const tableName of tableNames) {
    console.log(`Dropping table: ${tableName}`);
    await dbInstance.execAsync(`DROP TABLE IF EXISTS ${tableName};`);
  }
  console.log('All tables dropped.');
  // Clearing the singleton forces re-initialization; a stale client would point at dropped tables.
  db = null;
}

export * from './schema';
export { schema };
