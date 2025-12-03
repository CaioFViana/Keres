import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppDrizzleClient, DrizzleContext, initializeDrizzle } from './db';
import { migrate } from './db/migrate';
import AppNavigator from './navigation/AppNavigator';
import { useUserSettingsStore } from './state/userSettingsStore';
import { useTheme } from './theme';
import { ThemeProvider } from './theme/ThemeProvider';
import { isColorLight } from './theme/utils'; // Import isColorLight
import './utils/i18n';
import i18n from './utils/i18n';
import apiClient from './services/apiClient';
import { authTokenManager, setAuthDb } from './services/AuthTokenManager';
import NotificationPopup from './components/NotificationPopup'; // Import NotificationPopup

// Create a wrapper component for safe area
const SafeAreaWrapper = ({ children }: { children: React.ReactNode }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme(); // Get theme colors
  // Determine status bar style based on background color lightness
  const statusBarStyle = isColorLight(colors.background) ? 'dark' : 'light';

  return (
    <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: colors.background }}>
      <StatusBar style={statusBarStyle} />
      {children}
      <NotificationPopup /> {/* Render NotificationPopup here */}
    </View>
  );
};

const DatabaseInitializer = () => {
  const db = useSQLiteContext();
  const [dbInitialized, setDbInitialized] = useState(false);
  const [drizzleClient, setDrizzleClient] = useState<AppDrizzleClient | null>(null);
  const [userSettingsLoaded, setUserSettingsLoaded] = useState(false);
  const initializeUserSettings = useUserSettingsStore((state) => state.initializeSettings);

  console.log('DatabaseInitializer: db context', db);

  useEffect(() => {
    const initialize = async () => {
      console.log('DatabaseInitializer: Starting database initialization...');
      try {
        await migrate(db);
        const initializedDrizzle = initializeDrizzle(db);
        setDrizzleClient(initializedDrizzle);
        setDbInitialized(true);
        console.log('DatabaseInitializer: Database initialized successfully.');

        // Initialize AuthTokenManager with the Drizzle DB instance
        setAuthDb(initializedDrizzle);
        // Set the authTokenManager as the token provider for the API client
        apiClient.setTokenProvider(authTokenManager);

        const settings = await initializeUserSettings(initializedDrizzle);
        if (settings?.language) {
          i18n.changeLanguage(settings.language);
          console.log(`DatabaseInitializer: Language set to ${settings.language}`);
        }
        setUserSettingsLoaded(true);
        console.log('DatabaseInitializer: User settings loaded and language applied.');

      } catch (e) {
        console.error('DatabaseInitializer: Failed to initialize database or load settings', e);
      }
    };

    if (db) {
      initialize();
    } else {
      console.log('DatabaseInitializer: db context is null, waiting...');
    }
  }, [db, initializeUserSettings]);

  if (!dbInitialized || !drizzleClient || !userSettingsLoaded) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>{i18n.t('loading_application')}</Text>
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
          <SafeAreaWrapper>
            <DatabaseInitializer />
          </SafeAreaWrapper>
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
