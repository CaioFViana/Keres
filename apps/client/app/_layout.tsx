import { Stack } from 'expo-router';
import { AuthProvider } from '@/context/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack>
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="online-login" options={{ title: 'Online Login' }} />
        <Stack.Screen name="offline-login" options={{ title: 'Offline Login' }} />
        {/* The (authenticated) group will be handled by AuthProvider's redirect logic */}
        <Stack.Screen name="(authenticated)" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}
