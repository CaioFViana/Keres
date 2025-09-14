import { Stack } from 'expo-router';
import { AuthProvider } from '@/context/AuthContext';
import { I18nextProvider } from 'react-i18next';
import i18n from '../localization/i18n'; // Adjust path as needed

export default function RootLayout() {
  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <Stack screenOptions={{ title: 'Keres Story Organizer' }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="online-login" options={{ title: 'Online Login' }} />
          <Stack.Screen name="offline-login" options={{ title: 'Offline Login' }} />
          {/* The (authenticated) group will be handled by AuthProvider's redirect logic */}
          <Stack.Screen name="(authenticated)" options={{ headerShown: false, title: 'Dashboard' }} />
        </Stack>
      </AuthProvider>
    </I18nextProvider>
  );
}
