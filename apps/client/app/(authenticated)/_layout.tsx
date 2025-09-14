import { Stack } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import React, { useEffect, useState } from 'react';
import { i18nReadyPromise } from '../../localization/i18n';
import { ThemedText } from '@/components/themed-text';

export default function AuthenticatedLayout() {
  const [i18nLoaded, setI18nLoaded] = useState(false);

  useEffect(() => {
    const loadI18n = async () => {
      await i18nReadyPromise;
      setI18nLoaded(true);
    };
    loadI18n();
  }, []);

  if (!i18nLoaded) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

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
          name="create-story"
          options={{
            headerShown: true,
            title: 'Create Story',
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