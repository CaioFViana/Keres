import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native'; // Import ActivityIndicator and View

import SyncInitializer from '../components/SyncInitializer'; // Import SyncInitializer
import { useDrizzle } from '../db';
import GalleryDetailScreen from '../screens/gallery/GalleryDetailScreen';
import { getClientSettings } from '../services/ClientSettingsService';
import { useThemeStore } from '../state/themeStore';
import { useUserSettingsStore } from '../state/userSettingsStore';
import ColdInstallStack from './ColdInstallStack';
import MainSystemStack from './MainSystemStack';
import StorySelectionStack from './StorySelectionStack';

export type RootStackParamList = {
  ColdInstall: undefined;
  StorySelection: undefined;
  MainSystem: undefined;
  /**
   * Mesma tela de `GalleryStack.GalleryDetail`, montada aqui também (fora do Drawer) para
   * quando uma tela de entidade abre uma mídia vinculada. Empilhar na aba de Galeria faria
   * o voltar do Android cair na lista de galeria (a aba nasce com [GalleryList,
   * GalleryDetail] se ainda não tiver sido visitada nesta sessão); empilhando aqui na raiz,
   * voltar desfaz só este passo e devolve exatamente a tela de onde a pessoa veio - a aba
   * do Drawer em que ela estava nunca é tocada. Ver `useOpenGalleryMediaViewer`.
   */
  GalleryMediaViewer: { galleryId: string };
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
    <SyncInitializer>
      <RootStack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRouteName}>
        <RootStack.Screen name="ColdInstall" component={ColdInstallStack} />
        <RootStack.Screen name="StorySelection" component={StorySelectionStack} />
        <RootStack.Screen name="MainSystem" component={MainSystemStack} />
        <RootStack.Screen name="GalleryMediaViewer" component={GalleryDetailScreen} />
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
