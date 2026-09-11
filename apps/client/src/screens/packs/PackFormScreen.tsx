import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import ScreenSection from '@/src/components/layout/ScreenSection/ScreenSection';
import FormField from '@/src/components/common/forms/FormField/FormField';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import type { PackSelectionType } from '@keres/shared';
import { useNavigation, useRoute } from '@react-navigation/native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Button from '../../components/common/controls/Button/Button';
import ThemedSwitch from '../../components/common/controls/ThemedSwitch/ThemedSwitch';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '../../components/common/inputs/TextInput/TextInput';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonInputStyles } from '../../theme/commonStyles';
import { usePackFormActions } from './usePackFormActions';
import { usePackFormResources } from './usePackFormResources';
import { usePackFormState } from './usePackFormState';

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

const PackFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<{ goBack: () => void }>();
  const route = useRoute<{ key: string; name: string; params?: { packId?: string } }>();
  const initialPackId = route.params?.packId;
  const { userId } = useUserSettingsStore();
  const commonInputStyles = getCommonInputStyles(colors);

  useScreenHeader({
    target: 'parent',
    title: initialPackId ? t('packs_reextract') : t('packs_create'),
  });

  const { packServiceRef, stories, storiesLoading } = usePackFormResources(userId);
  const packFormState = usePackFormState({
    initialPackId,
    packServiceRef,
    stories,
  });
  const {
    sourceStoryId,
    name,
    setName,
    description,
    setDescription,
    language,
    setLanguage,
    authorName,
    setAuthorName,
    selection,
    chooseStory,
    toggle,
    loading,
    isEditing,
  } = packFormState;

  const { handleSave, saving } = usePackFormActions({
    state: packFormState,
    packServiceRef,
    navigation,
  });

  const styles = StyleSheet.create({
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    switchLabels: { flex: 1, marginRight: 12 },
    label: { fontSize: 16, fontWeight: 'bold', color: colors.text },
    switchHint: { color: colors.textSecondary, fontSize: 13 },
    nested: { marginLeft: 18 },
    cancelButton: { backgroundColor: colors.secondary },
  });

  if (storiesLoading || loading) {
    return <ScreenLoading />;
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
    <EntityFormContainer
      actions={
        <>
          <Button onPress={handleSave} disabled={saving} testID="save-pack">
            {isEditing ? t('packs_reextract') : t('save')}
          </Button>
          <Button onPress={() => navigation.goBack()} style={styles.cancelButton}>
            {t('cancel')}
          </Button>
        </>
      }
    >
      <FormField label={t('packs_source_story')}>
        <SingleSelectPill
          value={sourceStoryId}
          onValueChange={(value) => value && chooseStory(value)}
          options={stories.map((story) => ({ label: story.title, value: story.id }))}
          placeholder={t('packs_source_placeholder')}
          // Re-extraction is always from the story the pack came from; changing it would make the
          // "same pack, new version" promise a lie.
          disabled={isEditing}
        />
      </FormField>

      <ScreenSection title={t('packs_contents')} />
      {renderToggle('customAttributes', 'packs_toggle_attributes', 'packs_toggle_attributes_hint')}
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

      <ScreenSection title={t('packs_details')} />
      <FormField label={t('name')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            value={name}
            onChangeText={setName}
            placeholder={t('name')}
            style={commonInputStyles.input}
          />
        )}
      </FormField>
      <FormField label={t('description')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            value={description}
            onChangeText={setDescription}
            placeholder={t('description')}
            style={commonInputStyles.multiline}
            multiline
          />
        )}
      </FormField>
      <FormField label={t('language')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            value={language}
            onChangeText={setLanguage}
            placeholder={t('packs_language_placeholder')}
            style={commonInputStyles.input}
          />
        )}
      </FormField>
      <FormField label={t('author')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            value={authorName}
            onChangeText={setAuthorName}
            placeholder={t('author')}
            style={commonInputStyles.input}
          />
        )}
      </FormField>
    </EntityFormContainer>
  );
};

export default PackFormScreen;
