import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function WorldRulesScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">World Rules</ThemedText>
      <ThemedText>List of world rules will go here.</ThemedText>
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
