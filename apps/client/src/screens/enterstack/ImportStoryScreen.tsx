import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import ScreenSection from '@/src/components/layout/ScreenSection/ScreenSection';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { mediaFileService } from '../../services/MediaFileService';
import { createStoryService } from '../../services/storymanagement/StoryService';
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryListStore } from '../../state/storyListStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { createULID } from '../../utils/entityUtils';
import { commonScreenStyleDefs } from '../../theme/commonStyles';
import { pickStoryExportFile, StoryImportError } from '../../utils/storyTransfer';

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
      const { story: storyExport, media } = picked;

      const storyService = createStoryService(drizzleDb);

      // The importer inserts with remade ids, so it can also restore a parallel backup.
      const importedStoryId = createULID();

      // It writes the .zip's media files into the device's storage before creating the records - the gallery
      // is born with the local file, without depending on synchronizing with a server later. Empty for a
      // `.json`-only import.
      const localMediaPaths = new Map<string, string>();
      for (const item of media) {
        const localPath = await mediaFileService.writeDownloaded(
          importedStoryId,
          item.hash,
          item.mimeType,
          item.bytes,
        );
        localMediaPaths.set(item.hash, localPath);
      }

      // A null `serverId`: the file is a local copy. Linking it to a server is a separate decision, made on
      // the story selection screen.
      await storyService.importFullStory(
        userId,
        storyExport,
        null,
        null,
        localMediaPaths,
        importedStoryId,
      );

      showNotification(t('import_story_success', { title: storyExport.story.title }), 'success');
      fetchStoryList(storyService); // Keeps the story selection screen up to date.
    } catch (importError) {
      if (importError instanceof StoryImportError) {
        console.log('ImportStoryScreen: import rejected.', importError.message);
        const messageKey =
          importError.reason === 'future_format_version'
            ? 'import_story_future_version'
            : importError.reason === 'invalid_format'
              ? 'import_story_invalid_file'
              : importError.reason === 'corrupt_content'
                ? 'import_story_corrupt_content'
                : 'import_story_unreadable_file';
        showNotification(t(messageKey), 'error');
        return;
      }
      console.log('ImportStoryScreen: failed to import story.', importError);
      showNotification(t('import_story_failed'), 'error');
    } finally {
      navigation.dispatch(DrawerActions.closeDrawer());
      setImporting(false);
    }
  }, [drizzleDb, userId, navigation, showNotification, t, fetchStoryList]);

  const styles = StyleSheet.create({
    ...commonScreenStyleDefs(colors),
    content: {
      padding: 20,
      paddingBottom: 60,
    },
    sectionDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 14,
      lineHeight: 20,
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
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: 'bold',
      marginLeft: 8,
    },
    note: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 19,
      marginTop: 18,
    },
  });

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

export default ImportStoryScreen;
