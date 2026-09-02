import type { PackSelectionType } from '@keres/shared';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Button from '../../components/common/controls/Button/Button';
import FormActions from '../../components/common/controls/FormActions/FormActions';
import ThemedSwitch from '../../components/common/controls/ThemedSwitch/ThemedSwitch';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '../../components/common/inputs/TextInput/TextInput';
import KeyboardAwareScreen from '../../components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import { useDrizzle } from '../../db';
import type { StorySelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { createPackService } from '../../services/storymanagement/PackService';
import { createStoryService } from '../../services/storymanagement/StoryService';
import { useNotificationStore } from '../../state/notificationStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import {
  commonFormStyleDefs,
  getCommonContainerStyles,
  getCommonInputStyles,
} from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';
import { useDocumentTitle } from '../../utils/documentTitle';

/**
 * Making a pack out of a story, or re-extracting one.
 *
 * There is nothing to author here: every toggle names something the source story already has, and
 * the pack is whatever those toggles select. That is what keeps the feature at zero new CRUD screens
 * - and it is also why editing a pack is re-extraction rather than editing its contents.
 *
 * `language` and `authorName` are prefilled from the source story and editable from there, the same
 * treatment. They are the author's own words and are never translated.
 */

const ALL_OFF: PackSelectionType = {
  customAttributes: false,
  suggestions: false,
  suggestionsIncludeUsed: false,
  stats: false,
  tags: false,
};

const PackFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<{ goBack: () => void }>();
  const route = useRoute<{ key: string; name: string; params?: { packId?: string } }>();
  const packId = route.params?.packId;
  const drizzleDb = useDrizzle();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const { userId } = useUserSettingsStore();
  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);
  const scrollBottomPadding = useFormScrollBottomPadding();
  useDocumentTitle(packId ? t('packs_reextract') : t('packs_create'));

  const [stories, setStories] = useState<StorySelect[]>([]);
  const [sourceStoryId, setSourceStoryId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [selection, setSelection] = useState<PackSelectionType>(ALL_OFF);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const list = await createStoryService(drizzleDb).getAllStories(userId ?? undefined);
        setStories(list);
        if (packId) {
          const pack = (await createPackService(drizzleDb).listPacks()).find(
            (entry) => entry.id === packId,
          );
          if (pack) {
            setName(pack.name);
            setDescription(pack.description ?? '');
            setLanguage(pack.language ?? '');
            setAuthorName(pack.authorName ?? '');
            setSourceStoryId(pack.sourceStoryId);
          }
        }
      } catch (error) {
        console.error('PackFormScreen: failed to load.', error);
        showNotification(t('packs_load_failed'), 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [drizzleDb, packId, userId, showNotification, t]);

  /**
   * Prefills from the story the moment one is chosen, and only while creating: on a re-extraction
   * the author has already edited these, and overwriting their choice would be surprising.
   */
  const chooseStory = useCallback(
    (storyId: string) => {
      setSourceStoryId(storyId);
      if (packId) return;
      const story = stories.find((entry) => entry.id === storyId);
      if (!story) return;
      setLanguage(story.language ?? '');
      setAuthorName(story.author ?? '');
      if (!name.trim()) setName(story.title);
    },
    [packId, stories, name],
  );

  const toggle = useCallback(
    (key: keyof PackSelectionType) => (value: boolean) =>
      setSelection((current) => ({
        ...current,
        [key]: value,
        // The sub-toggle cannot outlive its parent, or a pack would claim to sweep in used values
        // while carrying no catalogue at all.
        ...(key === 'suggestions' && !value ? { suggestionsIncludeUsed: false } : {}),
      })),
    [],
  );

  const nothingSelected = useMemo(
    () =>
      !selection.customAttributes && !selection.suggestions && !selection.stats && !selection.tags,
    [selection],
  );

  const handleSave = useCallback(async () => {
    if (!sourceStoryId) {
      AppAlert.alert(t('error'), t('packs_source_required'));
      return;
    }
    if (!name.trim()) {
      AppAlert.alert(t('error'), t('packs_name_required'));
      return;
    }
    if (nothingSelected) {
      AppAlert.alert(t('error'), t('packs_selection_required'));
      return;
    }

    setSaving(true);
    try {
      const service = createPackService(drizzleDb);
      if (packId) {
        await service.reextractPack(packId, selection);
        await service.updatePackDetails(packId, {
          name: name.trim(),
          description: description.trim() || null,
          language: language.trim() || null,
          authorName: authorName.trim() || null,
        });
      } else {
        await service.createPack({
          sourceStoryId,
          name,
          description: description.trim() || null,
          language: language.trim() || null,
          authorName: authorName.trim() || null,
          selection,
        });
      }
      navigation.goBack();
    } catch (error) {
      console.error('PackFormScreen: failed to save pack.', error);
      showNotification(t('packs_save_failed'), 'error');
    } finally {
      setSaving(false);
    }
  }, [
    sourceStoryId,
    name,
    nothingSelected,
    packId,
    selection,
    description,
    language,
    authorName,
    drizzleDb,
    navigation,
    showNotification,
    t,
  ]);

  const styles = StyleSheet.create({
    ...commonFormStyleDefs(colors, scrollBottomPadding),
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    switchLabels: { flex: 1, marginRight: 12 },
    actions: { marginTop: 20, gap: 10 },
    switchHint: { color: colors.textSecondary, fontSize: 13 },
    nested: { marginLeft: 18 },
    cancelButton: { backgroundColor: colors.secondary },
  });

  if (loading) {
    return (
      <View style={[commonContainerStyles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const renderToggle = (
    key: keyof PackSelectionType,
    labelKey: string,
    hintKey: string,
    nested = false,
    disabled = false,
  ) => (
    <View style={[styles.switchRow, nested && styles.nested]}>
      <View style={styles.switchLabels}>
        <Text style={styles.label}>{t(labelKey)}</Text>
        <Text style={styles.switchHint}>{t(hintKey)}</Text>
      </View>
      <ThemedSwitch
        value={selection[key]}
        onValueChange={toggle(key)}
        disabled={disabled}
        testID={`pack-toggle-${key}`}
      />
    </View>
  );

  return (
    // `KeyboardAwareScreen` is itself the scroll view; a second one nested inside it took the
    // scrolling away from the one that knows where the keyboard is.
    <KeyboardAwareScreen
      style={commonContainerStyles.container}
      contentContainerStyle={styles.scrollViewContent}
    >
      <>
        <Text style={styles.label}>{t('packs_source_story')}</Text>
        <SingleSelectPill
          value={sourceStoryId}
          onValueChange={(value) => value && chooseStory(value)}
          options={stories.map((story) => ({ label: story.title, value: story.id }))}
          placeholder={t('packs_source_placeholder')}
          // Re-extraction is always from the story the pack came from; changing it would make the
          // "same pack, new version" promise a lie.
          disabled={Boolean(packId)}
        />

        <Text style={styles.sectionTitle}>{t('packs_contents')}</Text>
        {renderToggle(
          'customAttributes',
          'packs_toggle_attributes',
          'packs_toggle_attributes_hint',
        )}
        {renderToggle('tags', 'packs_toggle_tags', 'packs_toggle_tags_hint')}
        {renderToggle('stats', 'packs_toggle_stats', 'packs_toggle_stats_hint')}
        {renderToggle('suggestions', 'packs_toggle_suggestions', 'packs_toggle_suggestions_hint')}
        {renderToggle(
          'suggestionsIncludeUsed',
          'packs_toggle_suggestions_used',
          'packs_toggle_suggestions_used_hint',
          true,
          !selection.suggestions,
        )}

        <Text style={styles.sectionTitle}>{t('packs_details')}</Text>
        <Text style={styles.label}>{t('name')}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('name')}
          style={commonInputStyles.input}
        />
        <Text style={styles.label}>{t('description')}</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder={t('description')}
          style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
          multiline
        />
        <Text style={styles.label}>{t('language')}</Text>
        <TextInput
          value={language}
          onChangeText={setLanguage}
          placeholder={t('packs_language_placeholder')}
          style={commonInputStyles.input}
        />
        <Text style={styles.label}>{t('author')}</Text>
        <TextInput
          value={authorName}
          onChangeText={setAuthorName}
          placeholder={t('author')}
          style={commonInputStyles.input}
        />

        <FormActions stackOnCompact style={{ marginTop: 20 }}>
          <Button onPress={handleSave} disabled={saving} testID="save-pack">
            {packId ? t('packs_reextract') : t('save')}
          </Button>
          <Button onPress={() => navigation.goBack()} style={styles.cancelButton}>
            {t('cancel')}
          </Button>
        </FormActions>
      </>
    </KeyboardAwareScreen>
  );
};

export default PackFormScreen;
