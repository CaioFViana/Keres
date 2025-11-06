import { drizzle } from 'drizzle-orm/expo-sqlite';
import { SQLiteDatabase } from 'expo-sqlite';
import * as schema from './schema';
import React, { createContext, useContext } from 'react'; // Import React Context utilities

let _drizzleDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

// Define the type for the Drizzle client
export type AppDrizzleClient = ReturnType<typeof drizzle<typeof schema>>;

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
  if (!_drizzleDb) {
    _drizzleDb = drizzle(dbInstance, { schema });
  }
  return _drizzleDb; // Return the initialized client
}

// Remove getDb() as it will be replaced by useDrizzle
// export async function getDb() { ... }

export * from './schema';
export { schema };
