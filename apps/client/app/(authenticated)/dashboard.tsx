import { StyleSheet, TouchableOpacity } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/AuthContext';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Link } from 'expo-router';

export default function DashboardScreen() {
  const { signOut } = useAuth();
  const buttonBackgroundColor = useThemeColor({}, 'tint'); // Using 'tint' for button background

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Welcome to your Dashboard!</ThemedText>

      <TouchableOpacity style={[styles.button, { backgroundColor: buttonBackgroundColor }]} onPress={() => console.log('Create new Story pressed')}>
        <ThemedText>Create new Story</ThemedText>
      </TouchableOpacity>

      <TouchableOpacity onPress={signOut} style={[styles.button, { backgroundColor: buttonBackgroundColor }]}>
        <ThemedText>Log out</ThemedText>
      </TouchableOpacity>

      <ThemedText type="subtitle" style={styles.sectionTitle}>Your Stories:</ThemedText>
      <ThemedView style={styles.storyListPlaceholder}>
        <Link href={{ pathname: "/(authenticated)/(story)/[id]", params: { id: "story123" } }} asChild>
          <TouchableOpacity style={styles.button}>
            <ThemedText>Go to Story 123</ThemedText>
          </TouchableOpacity>
        </Link>
      </ThemedView>
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
  button: {
    marginTop: 15,
    padding: 10,
    borderRadius: 5,
  },
  sectionTitle: {
    marginTop: 30,
    marginBottom: 10,
  },
  storyListPlaceholder: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 20,
    minHeight: 100,
    width: '80%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
