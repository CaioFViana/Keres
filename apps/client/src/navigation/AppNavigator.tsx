import React, { useState, useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, StyleSheet } from 'react-native'; // Import ActivityIndicator and View

import ColdInstallStack from './ColdInstallStack';
import StorySelectionStack from './StorySelectionStack';
import MainSystemStack from './MainSystemStack';
import { getClientSettings } from '../services/ClientSettingsService';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { useThemeStore } from '../state/themeStore';
import { useDrizzle } from '../db';

type RootStackParamList = {
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

  const initialRouteName: keyof RootStackParamList = isColdInstallNeeded ? 'ColdInstall' : 'StorySelection';

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRouteName}>
      <RootStack.Screen name="ColdInstall" component={ColdInstallStack} />
      <RootStack.Screen name="StorySelection" component={StorySelectionStack} />
      <RootStack.Screen name="MainSystem" component={MainSystemStack} />
    </RootStack.Navigator>
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
