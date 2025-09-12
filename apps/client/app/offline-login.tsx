import React from 'react';
import { StyleSheet, Button, Alert } from 'react-native';
import { useAuth } from '@/context/AuthContext';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

// Keres' fixed user ID for offline mode, as defined in the backend's AuthMiddleware
const OFFLINE_USER_ID = '01K48ZX9A7P34EGK8SSQNKERES';

export default function OfflineLoginScreen() {
  const { signInOffline } = useAuth();

  const handleOfflineLogin = () => {
    // In offline mode, we don't perform actual authentication.
    // We simply set the user context with the fixed offline ID.
    signInOffline(OFFLINE_USER_ID);
    Alert.alert('Offline Mode', `Entering offline mode with User ID: ${OFFLINE_USER_ID}`);
    console.log('Entering offline mode with User ID:', OFFLINE_USER_ID);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Offline Mode</ThemedText>
      <ThemedText>You can work offline with local data.</ThemedText>

      <Button title="Enter Offline Mode" onPress={handleOfflineLogin} />
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
