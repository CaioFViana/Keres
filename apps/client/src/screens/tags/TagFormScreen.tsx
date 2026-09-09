import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import FormSwitchField from '@/src/components/common/forms/FormSwitchField/FormSwitchField';
import FormField from '@/src/components/common/forms/FormField/FormField';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import Button from '@/src/components/common/controls/Button/Button';
import ColorPickerInput from '@/src/components/common/inputs/ColorPickerInput/ColorPickerInput';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import type { TagsStackParamList } from '../../navigation/MainSystemStack';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonInputStyles } from '../../theme/commonStyles';
import { useTagFormActions } from './useTagFormActions';
import { useTagFormResources } from './useTagFormResources';
import { useTagFormState } from './useTagFormState';

type TagFormScreenRouteProp = RouteProp<TagsStackParamList, 'TagForm'>;
type TagFormScreenNavigationProp = NativeStackNavigationProp<TagsStackParamList, 'TagForm'>;

const TagFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation<TagFormScreenNavigationProp>();
  const route = useRoute<TagFormScreenRouteProp>();
  const { t } = useTranslation();
  const { userId } = useUserSettingsStore();
  const { tagId } = route.params || {};
  const { selectedStory } = useStoryStore();

  const commonInputStyles = getCommonInputStyles(colors);
  const { tagServiceRef } = useTagFormResources();

  const tagFormState = useTagFormState({
    tagId,
    tagServiceRef,
  });
  const {
    name,
    setName,
    color,
    setColor,
    isFavorite,
    setIsFavorite,
    extraNotes,
    setExtraNotes,
    loading,
    loadError,
    isEditing,
  } = tagFormState;

  const { deleting, handleDelete, handleSave, saving } = useTagFormActions({
    state: tagFormState,
    tagServiceRef,
    navigation,
    storyId: selectedStory?.id,
    userId,
  });

  useScreenHeader({
    target: 'parent',
    title: isEditing ? t('edit_tag_title') : t('create_tag_title'),
  });

  if (loading) {
    return <ScreenLoading />;
  }
  if (loadError) {
    return <ScreenError message={loadError} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <EntityFormContainer
      title={isEditing ? t('edit_tag_title') : t('create_tag_title')}
      description={t('tag_form_description')}
      actions={
        <>
          <Button onPress={handleSave} disabled={saving || deleting}>
            {isEditing ? t('save_changes') : t('create_tag')}
          </Button>
          {isEditing && (
            <Button
              onPress={handleDelete}
              style={{ backgroundColor: colors.error }}
              disabled={saving || deleting}
            >
              {t('delete_tag_title')}
            </Button>
          )}
        </>
      }
    >
      <FormField label={t('name')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('name_placeholder')}
            value={name}
            onChangeText={setName}
            style={commonInputStyles.input}
          />
        )}
      </FormField>

      <FormField label={t('color')}>
        <ColorPickerInput
          placeholder={t('select_tag_color')}
          currentColor={color}
          onSelectColor={setColor}
        />
      </FormField>

      <FormSwitchField label={t('is_favorite')} value={isFavorite} onValueChange={setIsFavorite} />

      <FormField label={t('extra_notes')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('extra_notes_placeholder')}
            value={extraNotes || ''}
            onChangeText={setExtraNotes}
            style={commonInputStyles.multiline}
            multiline
          />
        )}
      </FormField>
    </EntityFormContainer>
  );
};

export default TagFormScreen;
