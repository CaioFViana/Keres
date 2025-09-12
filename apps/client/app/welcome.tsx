import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function WelcomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Welcome to Keres!</ThemedText>
      <ThemedText type="subtitle">Choose your adventure mode:</ThemedText>

      <Link href="/online-login" style={styles.link}>
        <ThemedText type="link">Online Mode</ThemedText>
      </Link>

      <Link href="/offline-login" style={styles.link}>
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
