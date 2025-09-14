import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

// Keres' fixed user ID for offline mode, as defined in the backend's AuthMiddleware
const OFFLINE_USER_ID = '01K48ZX9A7P34EGK8SSQNKERES';

export default function OfflineLoginScreen() {
  const { t } = useTranslation();
  const { isAuthenticated, isOfflineMode, signInOffline } = useAuth();

  useEffect(() => {
    // If already authenticated in offline mode, redirect to dashboard
    if (isAuthenticated && isOfflineMode) {
      router.replace('/(authenticated)/dashboard');
    } else if (!isAuthenticated) {
      // If not authenticated, automatically sign in as offline user
      signInOffline(OFFLINE_USER_ID);
    }
  }, [isAuthenticated, isOfflineMode, signInOffline]);

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">{t('offlineLoginScreen.title')}</ThemedText>
      <ThemedText>{t('offlineLoginScreen.subtitle')}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
});