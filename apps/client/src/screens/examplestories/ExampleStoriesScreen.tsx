import Select from '@/src/components/common/inputs/Select/Select';
import { commonScreenStyleDefs, commonDetailStyleDefs } from '../../theme/commonStyles';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDrizzle } from '../../db';
import type { ExampleStoryEntry, ExampleStoryLanguage } from '../../exampleStories/types';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { createExampleStoryService } from '../../services/storymanagement/ExampleStoryService';
import { createStoryService } from '../../services/storymanagement/StoryService';
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryListStore } from '../../state/storyListStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { useDocumentTitle } from '../../utils/documentTitle';
import { getLanguageOptions } from '../../utils/i18n';

/**
 * Catálogo de histórias de exemplo empacotadas com o app.
 *
 * "Instalar" reaproveita a mesma infraestrutura de import de histórias (`ExampleStoryService`
 * -> `StoryService.importFullStory`): o usuário não cria nem remove exemplos do catálogo -
 * só escolhe instalar uma cópia no seu repertório, que passa a ser uma história normal,
 * removível pelos meios já existentes.
 *
 * A escolha de idioma usa o mesmo `Select` das telas de filtro (não um `Alert` com um botão
 * por idioma) - um dropdown não muda de forma conforme a lista de idiomas cresce, um `Alert`
 * viraria uma coluna de botões cada vez mais alta.
 *
 * O catálogo em si (`exampleStoryRegistry`) é estático - nenhuma história de exemplo ainda
 * está empacotada (ver `exampleStories/content/`), então o estado vazio é o que esta tela
 * mostra por enquanto.
 */

/** Só mostra o rótulo do idioma, sem precisar de uma chave nova por idioma da história. */
function useLanguageLabel() {
  const { t } = useTranslation();
  const labelByCode = useMemo(
    () => new Map(getLanguageOptions(t).map((option) => [option.value, option.label])),
    [t],
  );
  return useCallback((code: string) => labelByCode.get(code) ?? code, [labelByCode]);
}

/** Idioma preferido para pré-selecionar no dropdown: o do app atual, senão o primeiro empacotado. */
function pickPreferredLanguage(entry: ExampleStoryEntry, preferredLanguage: string): string | null {
  const match = entry.languages.find((language) => language.language === preferredLanguage);
  return (match ?? entry.languages[0])?.language ?? null;
}

interface StoryPreview {
  title: string;
  description: string | null;
  type: string | null;
  author: string | null;
}

/** Leitura defensiva - o conteúdo só é validado de verdade (`FullStoryExportSchema`) na instalação. */
function getStoryPreview(language: ExampleStoryLanguage, fallbackTitle: string): StoryPreview {
  const story = (
    language.story as {
      story?: { title?: unknown; description?: unknown; type?: unknown; author?: unknown };
    } | null
  )?.story;
  return {
    title: typeof story?.title === 'string' && story.title.trim() ? story.title : fallbackTitle,
    description: typeof story?.description === 'string' ? story.description : null,
    type: typeof story?.type === 'string' ? story.type : null,
    author: typeof story?.author === 'string' && story.author.trim() ? story.author : null,
  };
}

const ExampleStoriesScreen = () => {
  useBackButtonHandler();
  const { t, i18n } = useTranslation();
  useDocumentTitle(t('examples_title'));
  const { colors } = useTheme();
  const drizzleDb = useDrizzle();
  const { userId } = useUserSettingsStore();
  const { showNotification } = useNotificationStore();
  const { fetchStories: fetchStoryList } = useStoryListStore();
  const languageLabel = useLanguageLabel();

  const [entries, setEntries] = useState<ExampleStoryEntry[]>([]);
  /** `slug` da história em instalação, para desabilitar só o card dela. */
  const [installingSlug, setInstallingSlug] = useState<string | null>(null);
  /** Idioma escolhido no dropdown de cada história, por slug; ausente = ainda no padrão. */
  const [chosenLanguageBySlug, setChosenLanguageBySlug] = useState<Record<string, string>>({});

  useFocusEffect(
    useCallback(() => {
      setEntries(createExampleStoryService(drizzleDb).listExampleStories());
    }, [drizzleDb]),
  );

  const handleInstall = useCallback(
    async (slug: string, language: string) => {
      if (!userId) {
        showNotification(t('user_not_identified'), 'error');
        return;
      }

      setInstallingSlug(slug);
      try {
        const result = await createExampleStoryService(drizzleDb).installExampleStory(
          userId,
          slug,
          language,
        );
        if (result.status === 'installed') {
          showNotification(t('example_stories_install_success'), 'success');
          fetchStoryList(createStoryService(drizzleDb)); // Mantém a tela de seleção de histórias em dia.
        } else {
          showNotification(t('example_stories_install_failed'), 'error');
        }
      } catch (installError) {
        console.log(
          `ExampleStoriesScreen: failed to install example story ${slug}/${language}.`,
          installError,
        );
        showNotification(t('example_stories_install_failed'), 'error');
      } finally {
        setInstallingSlug(null);
      }
    },
    [drizzleDb, userId, showNotification, t, fetchStoryList],
  );

  const styles = StyleSheet.create({
    ...commonScreenStyleDefs(colors),
    ...commonDetailStyleDefs(colors),
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
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginBottom: 10,
      backgroundColor: colors.surface,
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
    cardAuthor: {
      fontSize: 12,
      color: colors.textSecondary,
      fontStyle: 'italic',
      marginTop: 2,
    },
    cardDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 6,
    },
    installRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
    },
    languageSelect: {
      flex: 1,
      marginRight: 10,
    },
    installButton: {
      width: 42,
      height: 42,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    installButtonDisabled: {
      opacity: 0.5,
    },
  });

  const renderItem = useCallback(
    ({ item }: { item: ExampleStoryEntry }) => {
      const preferredLanguage = pickPreferredLanguage(item, i18n.language);
      const previewLanguage =
        item.languages.find((language) => language.language === preferredLanguage) ??
        item.languages[0];
      if (!previewLanguage) return null;

      const preview = getStoryPreview(previewLanguage, item.slug);
      const isInstalling = installingSlug === item.slug;
      const selectedLanguage = chosenLanguageBySlug[item.slug] ?? preferredLanguage;
      const languageOptions = item.languages.map((language) => ({
        label: languageLabel(language.language),
        value: language.language,
      }));

      return (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons
              name={preview.type === 'branching' ? 'git-branch-outline' : 'book-outline'}
              size={18}
              color={colors.textSecondary}
            />
            <Text style={styles.cardTitle} numberOfLines={1}>
              {preview.title}
            </Text>
          </View>
          {!!preview.author && (
            <Text style={styles.cardAuthor} numberOfLines={1}>
              {t('example_stories_author', { author: preview.author })}
            </Text>
          )}
          {!!preview.description && (
            <Text style={styles.cardDescription} numberOfLines={2}>
              {preview.description}
            </Text>
          )}

          <View style={styles.installRow}>
            <View style={styles.languageSelect}>
              <Select
                options={languageOptions}
                value={selectedLanguage}
                onValueChange={(value) => {
                  if (!value) return;
                  setChosenLanguageBySlug((prev) => ({ ...prev, [item.slug]: value }));
                }}
                disabled={isInstalling}
              />
            </View>
            <TouchableOpacity
              style={[
                styles.installButton,
                (isInstalling || !selectedLanguage) && styles.installButtonDisabled,
              ]}
              onPress={() => selectedLanguage && handleInstall(item.slug, selectedLanguage)}
              disabled={isInstalling || !selectedLanguage}
              accessibilityLabel={t('example_stories_install')}
            >
              {isInstalling ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <Ionicons name="download-outline" size={20} color={colors.onPrimary} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [
      chosenLanguageBySlug,
      colors,
      handleInstall,
      i18n.language,
      installingSlug,
      languageLabel,
      styles,
      t,
    ],
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.slug}
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <Text style={styles.description}>{t('example_stories_description')}</Text>
        }
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
