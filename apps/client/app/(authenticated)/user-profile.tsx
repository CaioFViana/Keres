import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function UserProfileScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">User Profile</ThemedText>
      <ThemedText>User profile and settings will go here.</ThemedText>
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
