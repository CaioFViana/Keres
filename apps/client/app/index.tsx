import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';
import { setItem } from '@/utils/storage'; // Import from our storage utility
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const LAST_MODE_KEY = 'last_app_mode';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const handleModeSelection = async (mode: 'online' | 'offline') => {
    await setItem(LAST_MODE_KEY, mode);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">{t('welcomeScreen.title')}</ThemedText>
      <ThemedText type="subtitle">{t('welcomeScreen.subtitle')}</ThemedText>

      <Link href="/online-login" style={styles.link} onPress={() => handleModeSelection('online')}>
        <ThemedText type="link">{t('welcomeScreen.onlineMode')}</ThemedText>
      </Link>

      <Link href="/offline-login" style={styles.link} onPress={() => handleModeSelection('offline')}>
        <ThemedText type="link">{t('welcomeScreen.offlineMode')}</ThemedText>
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
