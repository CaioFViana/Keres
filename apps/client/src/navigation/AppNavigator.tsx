import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native'; // Import ActivityIndicator and View

import SyncInitializer from '@/src/components/features/app/SyncInitializer'; // Import SyncInitializer
import { useDrizzle } from '../db';
import { getClientSettings } from '../services/ClientSettingsService';
import { useThemeStore } from '../state/themeStore';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { useTheme } from '../theme';
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
  }, [dbInitialized, initializeUserSettings, initializeThemeSettings, drizzleDb]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const initialRouteName: keyof RootStackParamList = isColdInstallNeeded
    ? 'ColdInstall'
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
