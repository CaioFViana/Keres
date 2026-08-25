import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native'; // Import ActivityIndicator and View

import SyncInitializer from '@/src/components/features/app/SyncInitializer'; // Import SyncInitializer
import { useDrizzle } from '../db';
import { getClientSettings } from '../services/ClientSettingsService';
import { useThemeStore } from '../state/themeStore';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { useTheme } from '../theme';
import { readShowcaseRequest } from '../showcase/showcaseRequest';
import ColdInstallStack from './ColdInstallStack';
import MainSystemStack from './MainSystemStack';
import StorySelectionStack from './StorySelectionStack';

export type RootStackParamList = {
  ColdInstall: undefined;
  StorySelection: undefined;
  MainSystem: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();

interface AppNavigatorProps {
  dbInitialized: boolean;
}

const AppNavigator = ({ dbInitialized }: AppNavigatorProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isColdInstallNeeded, setIsColdInstallNeeded] = useState(false);
  const [showcaseReady, setShowcaseReady] = useState(false);
  const showcase = readShowcaseRequest();

  const drizzleDb = useDrizzle();
  const { colors } = useTheme();

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
      : 'StorySelection';

  return (
    <SyncInitializer>
      <RootStack.Navigator
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
        initialRouteName={initialRouteName}
      >
        <RootStack.Screen name="ColdInstall" component={ColdInstallStack} />
        <RootStack.Screen name="StorySelection" component={StorySelectionStack} />
        <RootStack.Screen name="MainSystem" component={MainSystemStack} />
      </RootStack.Navigator>
    </SyncInitializer>
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
