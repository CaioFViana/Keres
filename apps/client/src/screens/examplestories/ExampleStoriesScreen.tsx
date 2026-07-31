import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createStoryService, useDrizzle } from '../../db';
import { ExampleStoryEntry, ExampleStoryLanguage } from '../../exampleStories/types';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { createExampleStoryService } from '../../services/storymanagement/ExampleStoryService';
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryListStore } from '../../state/storyListStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getLanguageOptions } from '../../utils/i18n';

/**
 * Catálogo de histórias de exemplo empacotadas com o app.
 *
 * "Instalar" reaproveita a mesma infraestrutura de import de histórias (`ExampleStoryService`
 * -> `StoryService.importFullStory`): o usuário não cria nem remove exemplos do catálogo -
 * só escolhe instalar uma cópia no seu repertório, que passa a ser uma história normal,
 * removível pelos meios já existentes.
 *
 * O catálogo em si (`exampleStoryRegistry`) é estático - nenhuma história de exemplo ainda
 * está empacotada (ver `exampleStories/content/`), então o estado vazio é o que esta tela
 * mostra por enquanto.
 */

/** Só mostra o rótulo do idioma, sem precisar de uma chave nova por idioma da história. */
function useLanguageLabel() {
  const { t } = useTranslation();
  const labelByCode = useMemo(
    () => new Map(getLanguageOptions(t).map(option => [option.value, option.label])),
    [t]
  );
  return useCallback((code: string) => labelByCode.get(code) ?? code, [labelByCode]);
}

/** Título/descrição de exibição: prefere o idioma atual do app, senão o primeiro empacotado. */
function pickPreviewLanguage(entry: ExampleStoryEntry, preferredLanguage: string): ExampleStoryLanguage | null {
  return entry.languages.find(language => language.language === preferredLanguage) ?? entry.languages[0] ?? null;
}

interface StoryPreview {
  title: string;
  description: string | null;
  type: string | null;
}

/** Leitura defensiva - o conteúdo só é validado de verdade (`FullStoryExportSchema`) na instalação. */
function getStoryPreview(language: ExampleStoryLanguage, fallbackTitle: string): StoryPreview {
  const story = (language.story as { story?: { title?: unknown; description?: unknown; type?: unknown } } | null)?.story;
  return {
    title: typeof story?.title === 'string' && story.title.trim() ? story.title : fallbackTitle,
    description: typeof story?.description === 'string' ? story.description : null,
    type: typeof story?.type === 'string' ? story.type : null,
  };
}

const ExampleStoriesScreen = () => {
  useBackButtonHandler();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const drizzleDb = useDrizzle();
  const { userId } = useUserSettingsStore();
  const { showNotification } = useNotificationStore();
  const { fetchStories: fetchStoryList } = useStoryListStore();
  const languageLabel = useLanguageLabel();

  const [entries, setEntries] = useState<ExampleStoryEntry[]>([]);
  /** `slug` da história em instalação, para desabilitar só o card dela. */
  const [installingSlug, setInstallingSlug] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    setEntries(createExampleStoryService(drizzleDb).listExampleStories());
  }, [drizzleDb]));

  const handleInstall = useCallback(async (slug: string, language: string) => {
    if (!userId) {
      showNotification(t('user_not_identified'), 'error');
      return;
    }

    setInstallingSlug(slug);
    try {
      const result = await createExampleStoryService(drizzleDb).installExampleStory(userId, slug, language);
      if (result.status === 'installed') {
        showNotification(t('example_stories_install_success'), 'success');
        fetchStoryList(createStoryService(drizzleDb)); // Mantém a tela de seleção de histórias em dia.
      } else if (result.status === 'already_installed') {
        showNotification(t('example_stories_already_installed'), 'warning');
      } else {
        showNotification(t('example_stories_install_failed'), 'error');
      }
    } catch (installError) {
      console.log(`ExampleStoriesScreen: failed to install example story ${slug}/${language}.`, installError);
      showNotification(t('example_stories_install_failed'), 'error');
    } finally {
      setInstallingSlug(null);
    }
  }, [drizzleDb, userId, showNotification, t, fetchStoryList]);

  const handleInstallPress = useCallback((entry: ExampleStoryEntry, title: string) => {
    if (entry.languages.length === 1) {
      handleInstall(entry.slug, entry.languages[0].language);
      return;
    }

    Alert.alert(
      title,
      t('example_stories_choose_language_message'),
      [
        ...entry.languages.map(language => ({
          text: languageLabel(language.language),
          onPress: () => handleInstall(entry.slug, language.language),
        })),
        { text: t('cancel'), style: 'cancel' as const },
      ]
    );
  }, [handleInstall, languageLabel, t]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 20,
      paddingBottom: 60,
    },
    description: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 18,
      lineHeight: 20,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginBottom: 10,
      backgroundColor: colors.surface,
    },
    cardDisabled: {
      opacity: 0.5,
    },
    cardInfo: {
      flex: 1,
      marginRight: 12,
    },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      marginLeft: 8,
      flexShrink: 1,
    },
    cardDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 6,
    },
    languageRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 8,
    },
    languageChip: {
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: 8,
      paddingVertical: 2,
      marginRight: 6,
      marginTop: 4,
    },
    languageChipText: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    emptyText: {
      marginTop: 12,
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
    },
  });

  const renderItem = useCallback(({ item }: { item: ExampleStoryEntry }) => {
    const previewLanguage = pickPreviewLanguage(item, i18n.language);
    if (!previewLanguage) return null;

    const preview = getStoryPreview(previewLanguage, item.slug);
    const isInstalling = installingSlug === item.slug;

    return (
      <TouchableOpacity
        style={[styles.card, installingSlug !== null && styles.cardDisabled]}
        onPress={() => handleInstallPress(item, preview.title)}
        disabled={installingSlug !== null}
        accessibilityLabel={t('example_stories_install')}
      >
        <View style={styles.cardInfo}>
          <View style={styles.cardTitleRow}>
            <Ionicons
              name={preview.type === 'branching' ? 'git-branch-outline' : 'book-outline'}
              size={18}
              color={colors.textSecondary}
            />
            <Text style={styles.cardTitle} numberOfLines={1}>{preview.title}</Text>
          </View>
          {!!preview.description && (
            <Text style={styles.cardDescription} numberOfLines={2}>{preview.description}</Text>
          )}
          <View style={styles.languageRow}>
            {item.languages.map(language => (
              <View key={language.language} style={styles.languageChip}>
                <Text style={styles.languageChipText}>{languageLabel(language.language)}</Text>
              </View>
            ))}
          </View>
        </View>
        {isInstalling
          ? <ActivityIndicator size="small" color={colors.primary} />
          : <Ionicons name="download-outline" size={24} color={colors.primary} />}
      </TouchableOpacity>
    );
  }, [colors, handleInstallPress, i18n.language, installingSlug, languageLabel, styles, t]);

  return (
    <View style={styles.container}>
      <FlatList
        data={entries}
        keyExtractor={item => item.slug}
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<Text style={styles.description}>{t('example_stories_description')}</Text>}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="library-outline" size={54} color={colors.textSecondary} />
            <Text style={styles.emptyText}>{t('example_stories_empty')}</Text>
          </View>
        }
      />
    </View>
  );
};

export default ExampleStoriesScreen;
