import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
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
import { getLanguageOptions } from '../../utils/i18n';

/**
 * The catalog of example stories packaged with the app.
 *
 * "Install" reuses the same story import infrastructure (`ExampleStoryService` ->
 * `StoryService.importFullStory`): the user neither creates nor removes examples from the catalog -
 * they only choose to install a copy into their own repertoire, which then becomes an ordinary story,
 * removable through the existing means.
 *
 * The language choice uses the same `Select` as the filter screens (not an `Alert` with one button per
 * language) - a dropdown does not change shape as the list of languages grows, an `Alert` would become
 * an ever-taller column of buttons.
 *
 * The catalog itself (`exampleStoryRegistry`) is static - no example story is packaged yet (see
 * `exampleStories/content/`), so the empty state is what this screen shows for now.
 */

/** It only shows the language's label, with no need for a new key per story language. */
function useLanguageLabel() {
  const { t } = useTranslation();
  const labelByCode = useMemo(
    () => new Map(getLanguageOptions(t).map((option) => [option.value, option.label])),
    [t],
  );
  return useCallback((code: string) => labelByCode.get(code) ?? code, [labelByCode]);
}

/** The preferred language to pre-select in the dropdown: the app's current one, failing that the first */
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

/** A defensive read - the content is only really validated (`FullStoryExportSchema`) on installation. */
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
  useScreenHeader({ target: 'self', title: t('examples_title') });
  const { colors } = useTheme();
  const drizzleDb = useDrizzle();
  const { userId } = useUserSettingsStore();
  const { showNotification } = useNotificationStore();
  const { fetchStories: fetchStoryList } = useStoryListStore();
  const languageLabel = useLanguageLabel();

  const [entries, setEntries] = useState<ExampleStoryEntry[]>([]);
  /** The `slug` of the story being installed, to disable only its own card. */
  const [installingSlug, setInstallingSlug] = useState<string | null>(null);
  /** The language chosen in each story's dropdown, by slug; absent = still on the default. */
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
              <SingleSelectPill
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
