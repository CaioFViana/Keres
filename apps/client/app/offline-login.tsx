import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

// Keres' fixed user ID for offline mode, as defined in the backend's AuthMiddleware
const OFFLINE_USER_ID = '01K48ZX9A7P34EGK8SSQNKERES';

export default function OfflineLoginScreen() {
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
      <ThemedText type="title">Entering Offline Mode...</ThemedText>
      <ThemedText>Please wait while we set up your offline session.</ThemedText>
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