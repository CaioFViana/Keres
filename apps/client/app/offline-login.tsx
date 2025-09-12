import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function OfflineLoginScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Offline Login</ThemedText>
      <ThemedText>This is the offline login screen.</ThemedText>
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
