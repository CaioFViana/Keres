import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AppDrizzleClient, DrizzleContext, initializeDrizzle } from './db';
import { migrate } from './db/migrate'; // Import the new migrate function
import AppNavigator from './navigation/AppNavigator';
import { ThemeProvider } from './theme/ThemeProvider';
import './utils/i18n'; // Import i18n configuration
import i18n from './utils/i18n';

const DatabaseInitializer = () => {
  const db = useSQLiteContext();
  const [dbInitialized, setDbInitialized] = useState(false);
  const [drizzleClient, setDrizzleClient] = useState<AppDrizzleClient | null>(null);

  console.log('DatabaseInitializer: db context', db);

  useEffect(() => {
    const initialize = async () => {
      console.log('DatabaseInitializer: Starting database initialization...');
      try {
        await migrate(db); // Call the new migrate function
        const initializedDrizzle = initializeDrizzle(db);
        setDrizzleClient(initializedDrizzle);
        setDbInitialized(true);
        console.log('DatabaseInitializer: Database initialized successfully.');
      } catch (e) {
        console.error('DatabaseInitializer: Failed to initialize database', e);
        // Handle error appropriately, maybe show an error screen
      }
    };

    if (db) {
      initialize();
    } else {
      console.log('DatabaseInitializer: db context is null, waiting...');
    }
  }, [db]);

  if (!dbInitialized || !drizzleClient) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading application...</Text>
      </View>
    );
  }

  return (
    <DrizzleContext.Provider value={drizzleClient}>
      <AppNavigator dbInitialized={dbInitialized} />
    </DrizzleContext.Provider>
  );
};

export default function App() {
  return (
    <SQLiteProvider databaseName={'keres.db'}>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>
          <DatabaseInitializer />
        </ThemeProvider>
      </I18nextProvider>
    </SQLiteProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
