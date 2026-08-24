import AppAlertHost from '@/src/components/common/feedback/AppAlertHost/AppAlertHost';
import NotificationPopup from '@/src/components/common/feedback/NotificationPopup/NotificationPopup';
import DocumentTitleSync from '@/src/components/features/app/DocumentTitleSync';
import WebScrollbarTheme from '@/src/components/features/app/WebScrollbarTheme';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import {
  DefaultTheme as DefaultNavigationTheme,
  ThemeProvider as NavigationThemeProvider,
} from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { ActivityIndicator, LogBox, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppDrizzleClient, DrizzleContext, initializeDrizzle, useDrizzle } from './db';
import { migrate } from './db/migrate';
import AppNavigator from './navigation/AppNavigator';
import apiClient from './services/apiClient';
import { authTokenManager, setAuthDb } from './services/AuthTokenManager';
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

// react-native-dropdown-picker (used by our Select component everywhere) imports the
// deprecated SafeAreaView from 'react-native' for its modal list mode, even though we
// always use listMode="SCROLLVIEW" - the warning fires from building that unused JSX
// branch, not from anything in our own screens, so there's nothing here to actually fix.
LogBox.ignoreLogs(['SafeAreaView has been deprecated']);

// Create a wrapper component for safe area
const SafeAreaWrapper = ({ children }: { children: React.ReactNode }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme(); // Get theme colors
  // Determine status bar style based on background color lightness
  const statusBarStyle = isColorLight(colors.background) ? 'dark' : 'light';

  // O fundo da janela nativa aparece por instantes em transições de stack e Modal. Mantê-lo
  // sincronizado com a paleta evita revelar o branco padrão fora da árvore React.
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
      {/* AppAlert.alert() precisa poder ser chamado de qualquer tela, então o Modal que o
          renderiza mora aqui, não em cada tela. */}
      <AppAlertHost />
    </View>
  );
};

/**
 * Drawers and headers read React Navigation's theme, while the application reads its own
 * ThemeProvider. Keeping the two in sync prevents navigation's light default border from
 * appearing as a white divider in a dark story or dark mode.
 */
const NavigationThemeBridge = ({ children }: { children: React.ReactNode }) => {
  const { colors, isDarkMode } = useTheme();
  const navigationTheme = React.useMemo(
    () => ({
      ...DefaultNavigationTheme,
      dark: isDarkMode,
      colors: {
        ...DefaultNavigationTheme.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.notification,
      },
    }),
    [colors, isDarkMode],
  );

  return <NavigationThemeProvider value={navigationTheme}>{children}</NavigationThemeProvider>;
};

// New ThemeInitializer component to provide drizzleClient to ThemeProvider
const ThemeInitializer = ({ children }: { children: React.ReactNode }) => {
  const drizzleClient = useDrizzle(); // Get drizzleClient from context

  return (
    <ThemeProvider drizzleClient={drizzleClient}>
      <NavigationThemeBridge>
        <SafeAreaWrapper>{children}</SafeAreaWrapper>
      </NavigationThemeBridge>
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
        if (shouldRunSqliteWebSmokeProbe) {
          await runSqliteWebSmokeProbe(db);
        }
        const initializedDrizzle = initializeDrizzle(db);
        setDrizzleClient(initializedDrizzle);
        setDbInitialized(true);
        console.log('DatabaseInitializer: Database initialized successfully.');

        // Initialize AuthTokenManager with the Drizzle DB instance
        setAuthDb(initializedDrizzle);
        await authTokenManager.hydrateTokens();
        // Set the authTokenManager as the token provider for the API client
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
