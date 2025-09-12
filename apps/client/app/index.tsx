import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';
import { setItem } from '@/utils/storage'; // Import from our storage utility

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const LAST_MODE_KEY = 'last_app_mode';

export default function WelcomeScreen() {
  const handleModeSelection = async (mode: 'online' | 'offline') => {
    await setItem(LAST_MODE_KEY, mode);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Welcome to Keres!</ThemedText>
      <ThemedText type="subtitle">Choose your adventure mode:</ThemedText>

      <Link href="/online-login" style={styles.link} onPress={() => handleModeSelection('online')}>
        <ThemedText type="link">Online Mode</ThemedText>
      </Link>

      <Link href="/offline-login" style={styles.link} onPress={() => handleModeSelection('offline')}>
        <ThemedText type="link">Offline Mode</ThemedText>
      </Link>
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
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
