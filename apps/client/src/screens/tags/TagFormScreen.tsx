import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import FormSwitchField from '@/src/components/common/forms/FormSwitchField/FormSwitchField';
import FormField from '@/src/components/common/forms/FormField/FormField';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import EntityFormActions from '@/src/components/common/forms/EntityFormActions/EntityFormActions';
import FormTextAreaField from '@/src/components/common/forms/FormTextAreaField/FormTextAreaField';
import FormTextField from '@/src/components/common/forms/FormTextField/FormTextField';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import ColorPickerInput from '@/src/components/common/inputs/ColorPickerInput/ColorPickerInput';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useFormResetHeaderAction } from '../../hooks/useFormResetHeaderAction';
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
    storyId: selectedStory?.id,
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
    isDirty,
    resetForm,
  } = tagFormState;

  const { deleting, handleDelete, handleSave, saving } = useTagFormActions({
    state: tagFormState,
    tagServiceRef,
    navigation,
    storyId: selectedStory?.id,
    userId,
  });

  const resetHeaderAction = useFormResetHeaderAction({ isEditing, isDirty, resetForm });

  useScreenHeader({
    target: 'parent',
    title: isEditing ? t('edit_tag_title') : t('create_tag_title'),
    actions: resetHeaderAction,
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
        <EntityFormActions
          isEditing={isEditing}
          busy={saving || deleting}
          colors={colors}
          deleteLabel={t('delete_tag_title')}
          saveLabel={isEditing ? t('save_changes') : t('create_tag')}
          onDelete={handleDelete}
          onSave={handleSave}
        />
      }
    >
      <FormTextField
        label={t('name')}
        placeholder={t('name_placeholder')}
        value={name}
        onChangeText={setName}
        style={commonInputStyles.input}
      />

      <FormField label={t('color')}>
        <ColorPickerInput
          placeholder={t('select_tag_color')}
          currentColor={color}
          onSelectColor={setColor}
        />
      </FormField>

      <FormSwitchField label={t('is_favorite')} value={isFavorite} onValueChange={setIsFavorite} />

      <FormTextAreaField
        label={t('extra_notes')}
        placeholder={t('extra_notes_placeholder')}
        value={extraNotes}
        onChangeText={setExtraNotes}
        style={commonInputStyles.multiline}
      />
    </EntityFormContainer>
  );
};

export default TagFormScreen;
