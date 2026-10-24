import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import ScreenSection from '@/src/components/layout/ScreenSection/ScreenSection';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useDrizzle } from '@/src/db';
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import { importStoryFromSource } from '@/src/services/storymanagement/story-lifecycle/StoryImportService';
import { createStoryService } from '@/src/services/storymanagement/story-lifecycle/StoryService';
import { useNotificationStore } from '@/src/state/ui/notificationStore';
import { useStoryListStore } from '@/src/state/story/storyListStore';
import { useUserSettingsStore } from '@/src/state/app/userSettingsStore';
import { type ThemeColors, useTheme } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import { typography } from '@/src/theme/tokens';
import { commonScreenStyleDefs } from '@/src/theme/commonStyles';
import { pickStoryExportFile, StoryImportError } from '@/src/utils/io/storyTransfer';
import { storyImportMessageKey } from '@/src/utils/io/StoryImportError';
import { logger } from '@/src/utils/logging/logger';
import { fireAndLog } from '@/src/utils/logging/fireAndLog';

/**
 * Bringing a story in from a file. Taking one out is done from inside the story (Publish and export), where
 * it is about that story and not a pick from a list.
 */
const ImportStoryScreen = () => {
  const { t } = useTranslation();
  useScreenHeader({ target: 'self', title: t('import_story_title') });
  const navigation = useNavigation();
  const { colors } = useTheme();
  useBackButtonHandler();
  const drizzleDb = useDrizzle();
  const { userId } = useUserSettingsStore();
  const { showNotification } = useNotificationStore();
  const { fetchStories: fetchStoryList } = useStoryListStore();
  const [importing, setImporting] = useState(false);

  const handleImport = useCallback(async () => {
    if (!userId) {
      showNotification(t('user_not_identified'), 'error');
      return;
    }

    // The picker covers the app with a native activity: an open drawer would be revealed
    // mid-transition on return, so it is put away on both sides of the flow. A no-op when
    // already closed.
    navigation.dispatch(DrawerActions.closeDrawer());
    setImporting(true);
    try {
      const picked = await pickStoryExportFile();
      if (!picked) {
        return; // The user cancelled the picker; it is not an error.
      }
      // A local copy: linking it to a server is a separate decision, made on the story selection screen.
      const { title } = await importStoryFromSource(drizzleDb, userId, picked);

      showNotification(t('import_story_success', { title }), 'success');
      fireAndLog(fetchStoryList(createStoryService(drizzleDb)), 'fetchStoryList'); // Keeps the story selection screen up to date.
    } catch (importError) {
      if (importError instanceof StoryImportError) {
        logger.debug('ImportStoryScreen: import rejected.', importError.message);
        showNotification(t(storyImportMessageKey(importError.reason)), 'error');
        return;
      }
      logger.debug('ImportStoryScreen: failed to import story.', importError);
      showNotification(t('import_story_failed'), 'error');
    } finally {
      navigation.dispatch(DrawerActions.closeDrawer());
      setImporting(false);
    }
  }, [drizzleDb, userId, navigation, showNotification, t, fetchStoryList]);

  const styles = useThemedStyles(createStyles);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenSection title={t('import_story_title')} />
      <Text style={styles.sectionDescription}>{t('import_story_description')}</Text>

      <TouchableOpacity style={styles.importButton} onPress={handleImport} disabled={importing}>
        <Ionicons name="download-outline" size={20} color={colors.onPrimary} />
        <Text style={styles.importButtonText}>
          {importing ? t('import_story_in_progress') : t('import_story_choose_file')}
        </Text>
      </TouchableOpacity>

      <Text style={styles.note}>{t('import_story_export_elsewhere')}</Text>
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    ...commonScreenStyleDefs(colors),
    content: {
      padding: 20,
      paddingBottom: 60,
    },
    sectionDescription: {
      ...typography.body,
      color: colors.textSecondary,
      marginBottom: 14,
    },
    importButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    importButtonText: {
      ...typography.sectionTitle,
      color: colors.onPrimary,
      marginLeft: 8,
    },
    note: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 19,
      marginTop: 18,
    },
  });

export default ImportStoryScreen;
