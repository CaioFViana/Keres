import { drizzle } from 'drizzle-orm/expo-sqlite';
import { SQLiteDatabase } from 'expo-sqlite';
import { createContext, useContext } from 'react'; // Import React Context utilities
import { createStoryService } from '../services/storymanagement/StoryService'; // Import createStoryService
import * as schema from './schema';

export let db: AppDrizzleClient | null = null; // Export the Drizzle client

// Define the type for the Drizzle client
export type AppDrizzleClient = ReturnType<typeof drizzle<typeof schema>>;

// Type for the transaction client
export type AppDrizzleTransaction = Parameters<Parameters<AppDrizzleClient['transaction']>[0]>[0];

// Create a React Context for the Drizzle client
export const DrizzleContext = createContext<AppDrizzleClient | null>(null);

// Custom hook to use the Drizzle client from context
export const useDrizzle = () => {
  const context = useContext(DrizzleContext);
  if (context === null) {
    throw new Error('useDrizzle must be used within a DrizzleProvider');
  }
  return context;
};

export function initializeDrizzle(dbInstance: SQLiteDatabase) {
  if (!db) { // Use the exported 'db' variable
    db = drizzle(dbInstance, { schema });
  }
  return db; // Return the initialized client
}

export async function resetDatabase(dbInstance: SQLiteDatabase) { // Renamed parameter to avoid conflict
  console.log('Resetting database...');
  // Get all table names
  const tableNamesResult = await dbInstance.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
  const tableNames = tableNamesResult.map(row => row.name);

  // Drop all tables
  for (const tableName of tableNames) {
    console.log(`Dropping table: ${tableName}`);
    await dbInstance.execAsync(`DROP TABLE IF EXISTS ${tableName};`);
  }
  console.log('All tables dropped.');
  db = null; // Set the global db variable to null after reset
}

export * from './schema';
export { createStoryService, schema };

