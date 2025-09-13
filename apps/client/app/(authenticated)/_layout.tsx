import { Stack } from 'expo-router';
import { ThemedView } from '@/components/themed-view';

export default function AuthenticatedLayout() {
  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack screenOptions={{ contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen
          name="dashboard"
          options={{
            headerShown: true,
            title: 'Dashboard',
          }}
        />
        <Stack.Screen
          name="(story)"
          options={{ headerShown: false }}
        />
      </Stack>
    </ThemedView>
  );
}