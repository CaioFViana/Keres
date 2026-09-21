import AppAlertHost from '@/src/components/common/feedback/AppAlertHost/AppAlertHost';
import GuideHost from '@/src/components/common/feedback/GuideHost/GuideHost';
import SvgRasterHost from '@/src/components/features/export/SvgRasterHost';
import NotificationPopup from '@/src/components/common/feedback/NotificationPopup/NotificationPopup';
import DocumentTitleSync from '@/src/components/features/app/DocumentTitleSync';
import WebScrollbarTheme from '@/src/components/features/app/WebScrollbarTheme';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppDrizzleClient } from './db';
import { DrizzleContext, initializeDrizzle, useDrizzle } from './db';
import { migrate } from './db/migrate';
import AppNavigator from './navigation/AppNavigator';
import apiClient from './services/apiClient';
import { authTokenManager, setAuthDb } from './services/AuthTokenManager';
import { setEditorDraftDb } from './services/EditorDraftService';
import { restoreHostedCookieSession } from './services/HostedCookieSession';
import { hydrate as hydrateWebMediaStore } from './services/webMediaStore';
import { useUserSettingsStore } from './state/userSettingsStore';
import {
  runSqliteWebSmokeProbe,
  shouldRunSqliteWebSmokeProbe,
} from './testing/sqliteWebSmokeProbe';
import { useTheme } from './theme';
import { isColorLight } from './theme/commonStyles';
import { ThemeProvider } from './theme/ThemeProvider';
import i18n from './utils/i18n';

const SafeAreaWrapper = ({ children }: { children: React.ReactNode }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const statusBarStyle = isColorLight(colors.background) ? 'dark' : 'light';

  // The native window's background shows for an instant during stack and Modal transitions. Keeping it
  // in sync with the palette avoids revealing the default white outside the React tree.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        backgroundColor: colors.background,
      }}
    >
      <StatusBar style={statusBarStyle} />
      <WebScrollbarTheme />
      {children}
      <DocumentTitleSync />
      <NotificationPopup />
      {/* AppAlert.alert() must be callable from any screen, so the Modal that renders it
          lives here, not in each screen. */}
      <AppAlertHost />
      {/* The first-open guided tours follow the same pattern: a single store-driven Modal. */}
      <GuideHost />
      {/* Every export's PNG is rasterized by this hidden canvas, so it also
          lives here, next to AppAlertHost. */}
      <SvgRasterHost />
    </View>
  );
};

const ThemeInitializer = ({ children }: { children: React.ReactNode }) => {
  const drizzleClient = useDrizzle();

  // The navigation theme mapping lives with the navigator itself
  // (see navigation/navigationTheme.ts), which hands it to its NavigationContainer.
  return (
    <ThemeProvider drizzleClient={drizzleClient}>
      <SafeAreaWrapper>{children}</SafeAreaWrapper>
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
    // Boot order is load-bearing: the web media cache must exist before anything calls
    // `exists()`, auth tokens hydrate before the first API use, and the language applies
    // only after settings load. Screens mount only once all three are done (see below).
    const initialize = async () => {
      console.log('DatabaseInitializer: Starting database initialization...');
      try {
        if (Platform.OS === 'web') {
          // It populates mediaFileService's synchronous "what already exists" cache (see webMediaStore.ts)
          // before any screen/sync that depends on `exists()` runs.
          await hydrateWebMediaStore();
        }
        await migrate(db);
        if (shouldRunSqliteWebSmokeProbe) {
          await runSqliteWebSmokeProbe(db);
        }
        const initializedDrizzle = initializeDrizzle(db);
        setDrizzleClient(initializedDrizzle);
        setDbInitialized(true);
        console.log('DatabaseInitializer: Database initialized successfully.');

        setAuthDb(initializedDrizzle);
        setEditorDraftDb(initializedDrizzle);
        await authTokenManager.hydrateTokens();
        apiClient.setTokenProvider(authTokenManager);
        await restoreHostedCookieSession(initializedDrizzle);

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
  // SafeAreaWrapper (and form hooks deep in the tree) read insets via useSafeAreaInsets(),
  // which throws without this provider. expo-router/entry used to supply it implicitly;
  // with the entry registering <App /> directly, it lives here explicitly.
  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName={'keres.db'}>
        <I18nextProvider i18n={i18n}>
          <DatabaseInitializer />
        </I18nextProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
