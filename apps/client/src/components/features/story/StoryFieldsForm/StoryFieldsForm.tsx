import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import type { FavoriteBehavior } from '@keres/shared/entities/Story';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../../theme';
import { getCommonInputStyles } from '../../../../theme/commonStyles';
import { getLanguageOptions } from '../../../../utils/i18n';

interface StoryFieldsFormProps {
  title: string;
  onTitleChange: (value: string) => void;
  type: 'linear' | 'branching';
  onTypeChange: (value: 'linear' | 'branching') => void;
  typeDisabled?: boolean;
  /** `true` to lock favorite-behavior independently of `editable` (owner-only policy). */
  favoriteBehaviorDisabled?: boolean;
  description: string | null;
  onDescriptionChange: (value: string | null) => void;
  genre: string | null;
  onGenreChange: (value: string | null) => void;
  author: string | null;
  onAuthorChange: (value: string | null) => void;
  language: string | null;
  onLanguageChange: (value: string | null) => void;
  isFavorite: boolean;
  onIsFavoriteChange: (value: boolean) => void;
  favoriteBehavior: FavoriteBehavior;
  onFavoriteBehaviorChange: (value: FavoriteBehavior) => void;
  extraNotes: string | null;
  onExtraNotesChange: (value: string | null) => void;
  /** `false` em telas somente-leitura (papel de leitor) - desabilita todo campo. */
  editable?: boolean;
}

/**
 * A story's "core" fields (title, type, description, genre, author, language, favourite,
 * favourite behaviour and extra notes) - what `StorySettingsScreen` (inside the
 * drawer, editing only) and `StoryFormScreen` (outside the story stack, creation+editing)
 * duplicated almost byte for byte. Type and `favoriteBehavior` are owner policy on the server;
 * the screens pass `typeDisabled` / `favoriteBehaviorDisabled` for writers. Whatever is not
 * common to both (linear/branching type conversion, the server link, collaborators,
 * normalizeSceneTiming/allowReaderComments) stays in each screen, not here.
 */
const StoryFieldsForm: React.FC<StoryFieldsFormProps> = ({
  title,
  onTitleChange,
  type,
  onTypeChange,
  typeDisabled,
  favoriteBehaviorDisabled,
  description,
  onDescriptionChange,
  genre,
  onGenreChange,
  author,
  onAuthorChange,
  language,
  onLanguageChange,
  isFavorite,
  onIsFavoriteChange,
  favoriteBehavior,
  onFavoriteBehaviorChange,
  extraNotes,
  onExtraNotesChange,
  editable = true,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const commonInputStyles = getCommonInputStyles(colors);

  const storyTypeOptions = [
    { label: t('linear'), value: 'linear' },
    { label: t('branching'), value: 'branching' },
  ];
  const languageOptions = getLanguageOptions(t);

  return (
    <>
      <Text style={[styles.label, { color: colors.text }]}>{t('title')}</Text>
      <TextInput
        placeholder={t('title_placeholder')}
        value={title}
        onChangeText={onTitleChange}
        style={commonInputStyles.input}
        editable={editable}
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('type')}</Text>
      <SingleSelectPill
        options={storyTypeOptions}
        value={type}
        onValueChange={(value) => onTypeChange(value as 'linear' | 'branching')}
        placeholder={t('select_story_type')}
        disabled={typeDisabled ?? !editable}
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('description')}</Text>
      <TextInput
        placeholder={t('description_placeholder')}
        value={description || ''}
        onChangeText={onDescriptionChange}
        style={commonInputStyles.multiline}
        multiline
        editable={editable}
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('genre')}</Text>
      <TextInput
        placeholder={t('genre_placeholder')}
        value={genre || ''}
        onChangeText={onGenreChange}
        style={commonInputStyles.input}
        editable={editable}
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('author')}</Text>
      <TextInput
        placeholder={t('author_placeholder')}
        value={author || ''}
        onChangeText={onAuthorChange}
        style={commonInputStyles.input}
        editable={editable}
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('language')}</Text>
      <SingleSelectPill
        options={languageOptions}
        value={language}
        onValueChange={onLanguageChange}
        placeholder={t('select_language')}
        disabled={!editable}
      />

      <View style={styles.switchContainer}>
        <Text style={[styles.label, { color: colors.text, flex: 1, lineHeight: 30, marginTop: 5 }]}>
          {t('is_favorite')}
        </Text>
        <ThemedSwitch
          value={isFavorite}
          onValueChange={onIsFavoriteChange}
          style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
          disabled={!editable}
        />
      </View>

      <Text style={[styles.label, { color: colors.text }]}>{t('favorite_behavior')}</Text>
      <SingleSelectPill
        options={[
          { label: t('favorite_behavior_global'), value: 'global' },
          { label: t('favorite_behavior_individual'), value: 'individual' },
          { label: t('favorite_behavior_individual_public'), value: 'individual_public' },
        ]}
        value={favoriteBehavior}
        onValueChange={(value) => onFavoriteBehaviorChange(value as FavoriteBehavior)}
        placeholder={t('favorite_behavior')}
        disabled={favoriteBehaviorDisabled ?? !editable}
      />
      <Text style={{ color: colors.textSecondary, marginBottom: 0 }}>
        {t(`favorite_behavior_${favoriteBehavior}_description`)}
      </Text>

      <Text style={[styles.label, { color: colors.text }]}>{t('extra_notes')}</Text>
      <TextInput
        placeholder={t('extra_notes_placeholder')}
        value={extraNotes || ''}
        onChangeText={onExtraNotesChange}
        style={commonInputStyles.multiline}
        multiline
        editable={editable}
      />

    </>
  );
};

const styles = StyleSheet.create({
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 5,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 15,
    marginBottom: 5,
  },
});

export default StoryFieldsForm;
