import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '../../db';
import type { StorySelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { mediaFileService } from '../../services/MediaFileService';
import { createStoryService } from '../../services/storymanagement/StoryService';
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryListStore } from '../../state/storyListStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { AppAlert } from '../../utils/AppAlert';
import { useDocumentTitle } from '../../utils/documentTitle';
import { createULID } from '../../utils/entityUtils';
import { buildStoryZipBytes } from '../../utils/storyMediaBundle';
import { commonScreenStyleDefs } from '../../theme/commonStyles';
import {
  buildExportFileName,
  buildExportZipFileName,
  deliverStoryExport,
  deliverStoryZipExport,
  pickStoryExportFile,
  StoryImportError,
} from '../../utils/storyTransfer';

const ImportExportScreen = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('import_export_title'));
  const { colors } = useTheme();
  useBackButtonHandler();
  const drizzleDb = useDrizzle();
  const { userId } = useUserSettingsStore();
  const { showNotification } = useNotificationStore();
  const { fetchStories: fetchStoryList } = useStoryListStore();

  const [stories, setStories] = useState<StorySelect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** The id of the story being exported, to disable only its own row. */
  const [exportingStoryId, setExportingStoryId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const loadStories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const storyService = createStoryService(drizzleDb);
      setStories(await storyService.getAllStories());
    } catch (loadError) {
      console.log('ImportExportScreen: failed to load stories.', loadError);
      setError(t('failed_to_load_stories'));
    } finally {
      setLoading(false);
    }
  }, [drizzleDb, t]);

  // The list has to reflect imports and deletions made on other screens.
  useFocusEffect(
    useCallback(() => {
      loadStories();
    }, [loadStories]),
  );

  /** The metadata only - title, notes, gallery links... - without the media bytes. */
  const handleExportJson = useCallback(
    async (story: StorySelect) => {
      setExportingStoryId(story.id);
      try {
        const storyService = createStoryService(drizzleDb);
        const storyExport = await storyService.exportFullStory(story.id);
        const fileName = buildExportFileName(story.title);
        const result = await deliverStoryExport(storyExport, fileName);

        if (result.delivered) {
          showNotification(t('export_story_success', { fileName: result.fileName }), 'success');
        } else {
          // With no share sheet available the file exists, but the user has no way to reach it. Saying where it
          // is is more useful than claiming success.
          showNotification(
            t('export_story_no_share_target', { path: result.uri || result.fileName }),
            'warning',
          );
        }
      } catch (exportError) {
        console.log(`ImportExportScreen: failed to export story ${story.id}.`, exportError);
        showNotification(t('export_story_failed'), 'error');
      } finally {
        setExportingStoryId(null);
      }
    },
    [drizzleDb, showNotification, t],
  );

  /** A `.zip` with the metadata and the media files already downloaded on this device. */
  const handleExportZip = useCallback(
    async (story: StorySelect) => {
      setExportingStoryId(story.id);
      try {
        const storyService = createStoryService(drizzleDb);
        const storyExport = await storyService.exportFullStory(story.id);
        const { bytes, includedCount, totalCount } = await buildStoryZipBytes(
          storyExport,
          story.id,
        );
        const fileName = buildExportZipFileName(story.title);
        const result = await deliverStoryZipExport(bytes, fileName);

        if (!result.delivered) {
          showNotification(
            t('export_story_no_share_target', { path: result.uri || result.fileName }),
            'warning',
          );
        } else if (totalCount > 0 && includedCount < totalCount) {
          // Media this device has not downloaded cannot go into the package; the person needs to know the .zip
          // is incomplete, not think everything is in there.
          showNotification(
            t('export_story_zip_success_partial', {
              fileName: result.fileName,
              included: includedCount,
              total: totalCount,
            }),
            'warning',
          );
        } else {
          showNotification(t('export_story_success', { fileName: result.fileName }), 'success');
        }
      } catch (exportError) {
        console.log(`ImportExportScreen: failed to export story ${story.id} as zip.`, exportError);
        showNotification(t('export_story_failed'), 'error');
      } finally {
        setExportingStoryId(null);
      }
    },
    [drizzleDb, showNotification, t],
  );

  const handleExportPress = useCallback(
    (story: StorySelect) => {
      AppAlert.alert(t('export_story_choose_title'), t('export_story_choose_message'), [
        { text: t('export_story_choose_json'), onPress: () => handleExportJson(story) },
        { text: t('export_story_choose_zip'), onPress: () => handleExportZip(story) },
        { text: t('cancel'), style: 'cancel' },
      ]);
    },
    [handleExportJson, handleExportZip, t],
  );

  const handleImport = useCallback(async () => {
    if (!userId) {
      showNotification(t('user_not_identified'), 'error');
      return;
    }

    setImporting(true);
    try {
      const picked = await pickStoryExportFile();
      if (!picked) {
        return; // The user cancelled the picker; it is not an error.
      }
      const { story: storyExport, media } = picked;

      const storyService = createStoryService(drizzleDb);

      // O importador insere com ids refeitos. Portanto pode ser usado para restaurar um backup paralelo.
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
      await loadStories();
      fetchStoryList(storyService); // Mantém a tela de seleção de histórias em dia.
    } catch (importError) {
      if (importError instanceof StoryImportError) {
        console.log('ImportExportScreen: import rejected.', importError.message);
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
      console.log('ImportExportScreen: failed to import story.', importError);
      showNotification(t('import_story_failed'), 'error');
    } finally {
      setImporting(false);
    }
  }, [drizzleDb, userId, showNotification, t, loadStories, fetchStoryList]);

  const styles = StyleSheet.create({
    ...commonScreenStyleDefs(colors),
    content: {
      padding: 20,
      paddingBottom: 60,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 6,
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
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: 26,
    },
    storyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 10,
      backgroundColor: colors.surface,
    },
    storyRowDisabled: {
      opacity: 0.5,
    },
    storyInfo: {
      flex: 1,
      marginRight: 12,
    },
    storyTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
    },
    storyMeta: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
  });

  if (loading) {
    return <ScreenLoading />;
  }

  if (error) {
    return <ScreenError message={error} padded />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>{t('import_story_title')}</Text>
      <Text style={styles.sectionDescription}>{t('import_story_description')}</Text>

      <TouchableOpacity style={styles.importButton} onPress={handleImport} disabled={importing}>
        <Ionicons name="download-outline" size={20} color={colors.onPrimary} />
        <Text style={styles.importButtonText}>
          {importing ? t('import_story_in_progress') : t('import_story_choose_file')}
        </Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>{t('export_story_title')}</Text>
      <Text style={styles.sectionDescription}>{t('export_story_description')}</Text>

      {stories.length === 0 ? (
        <Text style={styles.emptyText}>{t('export_story_no_stories')}</Text>
      ) : (
        stories.map((story) => {
          const isExporting = exportingStoryId === story.id;
          return (
            <TouchableOpacity
              key={story.id}
              style={[styles.storyRow, isExporting && styles.storyRowDisabled]}
              onPress={() => handleExportPress(story)}
              disabled={exportingStoryId !== null}
            >
              <View style={styles.storyInfo}>
                <Text style={styles.storyTitle}>{story.title}</Text>
                <Text style={styles.storyMeta}>
                  {isExporting
                    ? t('export_story_in_progress')
                    : t(story.type === 'linear' ? 'linear' : 'branching')}
                </Text>
              </View>
              <Ionicons name="share-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
};

export default ImportExportScreen;
