import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ScreenError, ScreenLoading } from '../../components/common/ScreenState/ScreenState';
import { useDrizzle } from '../../db';
import { createStoryService } from '../../services/storymanagement/StoryService';
import { StorySelect } from '../../db/schema';
import { mediaFileService } from '../../services/MediaFileService';
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryListStore } from '../../state/storyListStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { buildStoryZipBytes } from '../../utils/storyMediaBundle';
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
  const { colors } = useTheme();
  const drizzleDb = useDrizzle();
  const { userId } = useUserSettingsStore();
  const { showNotification } = useNotificationStore();
  const { fetchStories: fetchStoryList } = useStoryListStore();

  const [stories, setStories] = useState<StorySelect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Id da história sendo exportada, para desabilitar só a linha dela. */
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

  // A lista precisa refletir importações e exclusões feitas em outras telas.
  useFocusEffect(useCallback(() => {
    loadStories();
  }, [loadStories]));

  /** Só os metadados - título, notas, vínculos de galeria... - sem os bytes da mídia. */
  const handleExportJson = useCallback(async (story: StorySelect) => {
    setExportingStoryId(story.id);
    try {
      const storyService = createStoryService(drizzleDb);
      const storyExport = await storyService.exportFullStory(story.id);
      const fileName = buildExportFileName(story.title);
      const result = await deliverStoryExport(storyExport, fileName);

      if (result.delivered) {
        showNotification(t('export_story_success', { fileName: result.fileName }), 'success');
      } else {
        // Sem share sheet disponível o arquivo existe, mas o usuário não tem como alcançá-lo.
        // Dizer onde ele está é mais útil do que alegar sucesso.
        showNotification(t('export_story_no_share_target', { path: result.uri || result.fileName }), 'warning');
      }
    } catch (exportError) {
      console.log(`ImportExportScreen: failed to export story ${story.id}.`, exportError);
      showNotification(t('export_story_failed'), 'error');
    } finally {
      setExportingStoryId(null);
    }
  }, [drizzleDb, showNotification, t]);

  /** Um `.zip` com os metadados e os arquivos de mídia que já estão baixados neste aparelho. */
  const handleExportZip = useCallback(async (story: StorySelect) => {
    setExportingStoryId(story.id);
    try {
      const storyService = createStoryService(drizzleDb);
      const storyExport = await storyService.exportFullStory(story.id);
      const { bytes, includedCount, totalCount } = await buildStoryZipBytes(storyExport, story.id);
      const fileName = buildExportZipFileName(story.title);
      const result = await deliverStoryZipExport(bytes, fileName);

      if (!result.delivered) {
        showNotification(t('export_story_no_share_target', { path: result.uri || result.fileName }), 'warning');
      } else if (totalCount > 0 && includedCount < totalCount) {
        // Mídia que este aparelho ainda não baixou não pode entrar no pacote; a pessoa
        // precisa saber que o .zip está incompleto, não achar que está tudo lá.
        showNotification(
          t('export_story_zip_success_partial', { fileName: result.fileName, included: includedCount, total: totalCount }),
          'warning'
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
  }, [drizzleDb, showNotification, t]);

  const handleExportPress = useCallback((story: StorySelect) => {
    Alert.alert(
      t('export_story_choose_title'),
      t('export_story_choose_message'),
      [
        { text: t('export_story_choose_json'), onPress: () => handleExportJson(story) },
        { text: t('export_story_choose_zip'), onPress: () => handleExportZip(story) },
        { text: t('cancel'), style: 'cancel' },
      ]
    );
  }, [handleExportJson, handleExportZip, t]);

  const handleImport = useCallback(async () => {
    if (!userId) {
      showNotification(t('user_not_identified'), 'error');
      return;
    }

    setImporting(true);
    try {
      const picked = await pickStoryExportFile();
      if (!picked) {
        return; // Usuário cancelou o seletor; não é erro.
      }
      const { story: storyExport, media } = picked;

      const storyService = createStoryService(drizzleDb);

      // O importador insere com os ids originais, então uma história já presente colidiria na
      // chave primária. Avisar antes é melhor do que deixar o insert falhar sem explicação.
      const existing = await storyService.getStoryById(storyExport.story.id);
      if (existing) {
        showNotification(t('import_story_already_exists', { title: existing.title }), 'warning');
        return;
      }

      // Grava os arquivos de mídia do .zip no armazenamento do aparelho antes de criar os
      // registros - a galeria já nasce com o arquivo local, sem depender de sincronizar com
      // um servidor depois. Vazio para uma importação só de `.json`.
      const localMediaPaths = new Map<string, string>();
      for (const item of media) {
        const localPath = await mediaFileService.writeDownloaded(storyExport.story.id, item.hash, item.mimeType, item.bytes);
        localMediaPaths.set(item.hash, localPath);
      }

      // `serverId` nulo: o arquivo é uma cópia local. Vincular a um servidor é uma decisão
      // separada, feita na tela de seleção de histórias.
      await storyService.importFullStory(userId, storyExport, null, localMediaPaths);

      showNotification(t('import_story_success', { title: storyExport.story.title }), 'success');
      await loadStories();
      fetchStoryList(storyService); // Mantém a tela de seleção de histórias em dia.
    } catch (importError) {
      if (importError instanceof StoryImportError) {
        console.log('ImportExportScreen: import rejected.', importError.message);
        showNotification(
          importError.reason === 'invalid_format' ? t('import_story_invalid_file') : t('import_story_unreadable_file'),
          'error'
        );
        return;
      }
      console.log('ImportExportScreen: failed to import story.', importError);
      showNotification(t('import_story_failed'), 'error');
    } finally {
      setImporting(false);
    }
  }, [drizzleDb, userId, showNotification, t, loadStories, fetchStoryList]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
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
        stories.map(story => {
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
                  {isExporting ? t('export_story_in_progress') : t(story.type === 'linear' ? 'linear' : 'branching')}
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
