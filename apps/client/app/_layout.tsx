import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="online-login" options={{ title: 'Online Login' }} />
      <Stack.Screen name="offline-login" options={{ title: 'Offline Login' }} />
    </Stack>
  );
}