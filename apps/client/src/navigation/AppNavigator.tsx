import {
  createNavigationContainerRef,
  NavigationContainer,
  type NavigatorScreenParams,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import SyncInitializer from '@/src/components/features/app/SyncInitializer';
import { useDrizzle } from '../db';
import { legalIsBehind } from '../legal/clientLegalStatus';
import { getAcceptedClientLegal } from '../legal/clientTermsAcceptance';
import LegalUpdateScreen from '../screens/enterstack/LegalUpdateScreen';
import { getClientSettings } from '../services/ClientSettingsService';
import { VERIFICATION_PENDING_EVENT } from '../services/apiClient';
import { useHeaderBackActionStore } from '../state/headerBackActionStore';
import { useThemeStore } from '../state/themeStore';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { useTheme } from '../theme';
import { readShowcaseRequest } from '../showcase/showcaseRequest';
import { entityEventEmitter } from '../utils/EventEmitter';
import ColdInstallStack from './ColdInstallStack';
import MainSystemStack from './MainSystemStack';
import { buildNavigationTheme } from './navigationTheme';
import { openServerVerification } from './openServerVerification';
import StorySelectionStack, { type StorySelectionDrawerParamList } from './StorySelectionStack';
import { attachWebHistoryBack, hasScreenBehind } from './webHistoryBack';

export type RootStackParamList = {
  ColdInstall: undefined;
  LegalUpdate: undefined;
  StorySelection: NavigatorScreenParams<StorySelectionDrawerParamList> | undefined;
  MainSystem: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();

/**
 * Whether the Terms or the Privacy Policy is behind the text shipped now. A record that cannot be read asks nothing:
 * the app opens the way it always did rather than being held back by its own storage.
 */
async function isLegalUpdateNeeded(): Promise<boolean> {
  try {
    const [terms, privacy] = await Promise.all([
      getAcceptedClientLegal('terms'),
      getAcceptedClientLegal('privacy'),
    ]);
    const behind = legalIsBehind(terms?.version ?? null, privacy?.version ?? null);
    return behind.terms || behind.privacy;
  } catch {
    return false;
  }
}

const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** What the browser's Back button does: what the header's back arrow does on the screen in front. */
function goBackLikeTheHeader() {
  const store = useHeaderBackActionStore.getState();
  if (store.backAction) {
    store.backAction();
    return;
  }
  const wayBack = store.consumeCrossStackReturnAction(navigationRef.getCurrentRoute()?.name);
  if (wayBack) wayBack();
  else navigationRef.goBack();
}

/** Whether the header shows a back arrow on the screen in front: the browser's Back has somewhere to go. */
const appHasWayBack = () => {
  const { crossStackReturnScreen } = useHeaderBackActionStore.getState();
  const current = navigationRef.getCurrentRoute()?.name;
  return (
    (crossStackReturnScreen !== undefined && crossStackReturnScreen === current) ||
    // From the open story down: the story list under it is left from the menu, not by Back.
    hasScreenBehind(
      navigationRef.getRootState()?.routes[navigationRef.getRootState()?.index ?? 0]?.state,
    )
  );
};

interface AppNavigatorProps {
  dbInitialized: boolean;
}

const AppNavigator = ({ dbInitialized }: AppNavigatorProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isColdInstallNeeded, setIsColdInstallNeeded] = useState(false);
  const [showcaseReady, setShowcaseReady] = useState(false);
  const [legalUpdateNeeded, setLegalUpdateNeeded] = useState(false);
  const showcase = readShowcaseRequest();
  const stopWebHistory = useRef<(() => void) | null>(null);

  // The web build's Back button goes back in the app (see webHistoryBack).
  useEffect(() => () => stopWebHistory.current?.(), []);

  // A pending account's call refused by its server opens the age check, once (see openServerVerification). A refusal
  // that comes before the navigation is ready waits for it, in `onReady`.
  const verificationWaiting = useRef<string | null>(null);
  useEffect(() => {
    const onVerificationPending = (serverId: string) => {
      if (navigationRef.isReady()) openServerVerification(navigationRef, serverId);
      else verificationWaiting.current = serverId;
    };
    entityEventEmitter.on(VERIFICATION_PENDING_EVENT, onVerificationPending);
    return () => entityEventEmitter.off(VERIFICATION_PENDING_EVENT, onVerificationPending);
  }, []);

  const drizzleDb = useDrizzle();
  const { colors, isDarkMode } = useTheme();
  const navigationTheme = useMemo(
    () => buildNavigationTheme(colors, isDarkMode),
    [colors, isDarkMode],
  );

  const initializeUserSettings = useUserSettingsStore((state) => state.initializeSettings);
  const initializeThemeSettings = useThemeStore((state) => state.initializeTheme);

  useEffect(() => {
    if (!dbInitialized) {
      return;
    }

    const checkColdInstall = async () => {
      try {
        // The showcase creates its own settings; the welcome screen does not get in the way.
        if (showcase) {
          // A late import: the showcase drags the whole story services along, and none of that
          // needs to exist when the app opens normally (which is always, apart from the screen capture).
          const { prepareShowcase } = await import('../showcase/prepareShowcase');
          const ready = await prepareShowcase(drizzleDb, showcase);
          setShowcaseReady(ready);
          setIsColdInstallNeeded(!ready);
          await initializeThemeSettings(drizzleDb);
          return;
        }

        const settings = await getClientSettings(drizzleDb);
        if (!settings) {
          setIsColdInstallNeeded(true);
        } else {
          await initializeUserSettings(drizzleDb);
          await initializeThemeSettings(drizzleDb);
          setLegalUpdateNeeded(await isLegalUpdateNeeded());
          setIsColdInstallNeeded(false);
        }
      } catch (error) {
        console.error('Error checking for client settings:', error);
        setIsColdInstallNeeded(true);
      } finally {
        setIsLoading(false);
      }
    };

    checkColdInstall();
  }, [dbInitialized, initializeUserSettings, initializeThemeSettings, drizzleDb, showcase]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const initialRouteName: keyof RootStackParamList = isColdInstallNeeded
    ? 'ColdInstall'
    : showcaseReady
      ? // The showcase has already chosen the story; going through the selection would only show a screen the
        // capture does not want.
        'MainSystem'
      : legalUpdateNeeded
        ? 'LegalUpdate'
        : 'StorySelection';

  // expo-router/entry used to wrap the whole app in its own navigation container;
  // with the entry registering <App /> directly, the container lives here, owning
  // this navigator tree. No linking prop: deep-link routing was never configured.
  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        if (verificationWaiting.current) {
          openServerVerification(navigationRef, verificationWaiting.current);
          verificationWaiting.current = null;
        }
        if (Platform.OS !== 'web' || typeof window === 'undefined' || stopWebHistory.current)
          return;
        stopWebHistory.current = attachWebHistoryBack(
          {
            canGoBack: appHasWayBack,
            addListener: (type, callback) => navigationRef.addListener(type, callback),
          },
          window,
          goBackLikeTheHeader,
        );
      }}
      theme={navigationTheme}
      // Left on, React Navigation writes the focused route's name (`DeviceIndex`, `PackList`) into the
      // title whenever the screen sets its title on a parent navigator - racing the explicit
      // `setDocumentTitle` calls. The screens own the title (see `utils/documentTitle`).
      documentTitle={{ enabled: false }}
    >
      <SyncInitializer>
        <RootStack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
          initialRouteName={initialRouteName}
        >
          <RootStack.Screen name="ColdInstall" component={ColdInstallStack} />
          <RootStack.Screen name="LegalUpdate" component={LegalUpdateScreen} />
          <RootStack.Screen name="StorySelection" component={StorySelectionStack} />
          <RootStack.Screen name="MainSystem" component={MainSystemStack} />
        </RootStack.Navigator>
      </SyncInitializer>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AppNavigator;
