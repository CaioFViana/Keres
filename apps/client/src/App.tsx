import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { ActivityIndicator, LogBox, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppAlertHost from '@/src/components/common/feedback/AppAlertHost/AppAlertHost';
import NotificationPopup from '@/src/components/common/feedback/NotificationPopup/NotificationPopup';
import DocumentTitleSync from '@/src/components/features/app/DocumentTitleSync';
import SyncConflictModal from '@/src/components/features/sync/SyncConflictModal/SyncConflictModal';
import { AppDrizzleClient, DrizzleContext, initializeDrizzle, useDrizzle } from './db';
import { migrate } from './db/migrate';
import { hydrate as hydrateWebMediaStore } from './services/webMediaStore';
import AppNavigator from './navigation/AppNavigator';
import apiClient from './services/apiClient';
import { authTokenManager, setAuthDb } from './services/AuthTokenManager';
import { useUserSettingsStore } from './state/userSettingsStore';
import { useTheme } from './theme';
import { isColorLight } from './theme/commonStyles';
import { ThemeProvider } from './theme/ThemeProvider';
import i18n from './utils/i18n';

// react-native-dropdown-picker (used by our Select component everywhere) imports the
// deprecated SafeAreaView from 'react-native' for its modal list mode, even though we
// always use listMode="SCROLLVIEW" - the warning fires from building that unused JSX
// branch, not from anything in our own screens, so there's nothing here to actually fix.
LogBox.ignoreLogs(["SafeAreaView has been deprecated"]);

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
      <DocumentTitleSync />
      <NotificationPopup />
      {/*
        Montado aqui, junto das notificações, para poder aparecer sobre qualquer tela: um
        conflito trava a sincronização daquela entidade e precisa ser decidido onde o
        usuário estiver, não numa aba que ele talvez nunca abra.
      */}
      <SyncConflictModal />
      {/* Mesmo motivo do SyncConflictModal acima: AppAlert.alert() precisa poder ser chamado
          de qualquer tela, então o Modal que o renderiza mora aqui, não em cada tela. */}
      <AppAlertHost />
    </View>
  );
};

// New ThemeInitializer component to provide drizzleClient to ThemeProvider
const ThemeInitializer = ({ children }: { children: React.ReactNode }) => {
  const drizzleClient = useDrizzle(); // Get drizzleClient from context

  return (
    <ThemeProvider drizzleClient={drizzleClient}> 
      <SafeAreaWrapper>
        {children}
      </SafeAreaWrapper>
    </ThemeProvider>
  );
};

const DatabaseInitializer = () => {
  const db = useSQLiteContext();
  const [dbInitialized, setDbInitialized] = useState(false);
  const [drizzleClient, setDrizzleClient] = useState<AppDrizzleClient | null>(null);
  const [userSettingsLoaded, setUserSettingsLoaded] = useState(false);
  const initializeUserSettings = useUserSettingsStore((state) => state.initializeSettings);

  useEffect(() => {
    const initialize = async () => {
      console.log('DatabaseInitializer: Starting database initialization...');
      try {
        if (Platform.OS === 'web') {
          // Popula o cache síncrono de "o que já existe" do mediaFileService (ver
          // webMediaStore.ts) antes de qualquer tela/sync que dependa de `exists()` rodar.
          await hydrateWebMediaStore();
        }
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
    }
    else {
      console.log('DatabaseInitializer: db context is null, waiting...');
    }
  }, [db, initializeUserSettings]);

  if (!dbInitialized || !drizzleClient || !userSettingsLoaded) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>{i18n.t('loading_application') || 'Loading...'}</Text>
      </View>
    );
  }

  return (
    <DrizzleContext.Provider value={drizzleClient}>
      <ThemeInitializer>
        <AppNavigator dbInitialized={dbInitialized} />
      </ThemeInitializer>
    </DrizzleContext.Provider>
  );
};

export default function App() {
  return (
    <SQLiteProvider databaseName={'keres.db'}>
      <I18nextProvider i18n={i18n}>
        <DatabaseInitializer />
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
