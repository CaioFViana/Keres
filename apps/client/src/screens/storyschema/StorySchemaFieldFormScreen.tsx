import FormSwitchField from '@/src/components/common/forms/FormSwitchField/FormSwitchField';
import FormField from '@/src/components/common/forms/FormField/FormField';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import Button from '@/src/components/common/controls/Button/Button';
import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import AttributeValueInput from '@/src/components/common/forms/CustomAttributeFields/AttributeValueInput';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import type { StorySchemaEntityType } from '@keres/shared';
import { AttributeType, STORY_SCHEMA_ENTITY_TYPES } from '@keres/shared';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useStorySchemaFields } from '../../hooks/useStorySchemaFields';
import type { CustomizationStackParamList } from '../../navigation/MainSystemStack';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonInputStyles } from '../../theme/commonStyles';
import { useStorySchemaFieldFormActions } from './useStorySchemaFieldFormActions';
import { useStorySchemaFieldFormResources } from './useStorySchemaFieldFormResources';
import { useStorySchemaFieldFormState } from './useStorySchemaFieldFormState';

type StorySchemaFieldFormScreenRouteProp = RouteProp<
  CustomizationStackParamList,
  'StorySchemaFieldForm'
>;
type StorySchemaFieldFormScreenNavigationProp = NativeStackNavigationProp<
  CustomizationStackParamList,
  'StorySchemaFieldForm'
>;

const ATTRIBUTE_TYPE_OPTIONS = Object.values(AttributeType);

const StorySchemaFieldFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<StorySchemaFieldFormScreenNavigationProp>();
  const route = useRoute<StorySchemaFieldFormScreenRouteProp>();
  const { entityType, fieldId: initialFieldId } = route.params;
  const { selectedStory } = useStoryStore();
  const storyId = selectedStory?.id;
  const { userId } = useUserSettingsStore();
  const commonInputStyles = getCommonInputStyles(colors);
  const existingFields = useStorySchemaFields(storyId, entityType);
  const onFieldMissing = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const { storySchemaFieldServiceRef } = useStorySchemaFieldFormResources();

  const storySchemaFieldFormState = useStorySchemaFieldFormState({
    initialFieldId,
    storySchemaFieldServiceRef,
    onFieldMissing,
  });
  const {
    name,
    key,
    description,
    setDescription,
    type,
    setType,
    targetEntityType,
    setTargetEntityType,
    isRequired,
    setIsRequired,
    defaultValue,
    setDefaultValue,
    loading,
    isEditing,
    handleNameChange,
    handleKeyChange,
  } = storySchemaFieldFormState;

  const { handleSave, saving } = useStorySchemaFieldFormActions({
    state: storySchemaFieldFormState,
    storySchemaFieldServiceRef,
    navigation,
    storyId,
    userId,
    entityType,
    initialFieldId,
    existingFieldCount: existingFields.length,
  });

  useScreenHeader({
    target: 'parent',
    title: isEditing ? t('edit_attribute_title') : t('create_attribute_title'),
  });

  const typeOptions = ATTRIBUTE_TYPE_OPTIONS.map((value) => ({
    label: t(`attribute_type_${value}`),
    value,
  }));
  const targetEntityTypeOptions = STORY_SCHEMA_ENTITY_TYPES.map((value) => ({
    label: t(`${value.toLowerCase()}s`),
    value,
  }));

  if (loading) {
    return <ScreenLoading message={t('loading')} />;
  }

  return (
    <EntityFormContainer
      actions={
        <Button onPress={handleSave} disabled={saving}>
          {saving ? t('saving') : t('save')}
        </Button>
      }
    >
      <FormField label={t('attribute_display_name')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('attribute_display_name_placeholder')}
            value={name}
            onChangeText={handleNameChange}
            style={commonInputStyles.input}
          />
        )}
      </FormField>

      <FormField label={t('attribute_internal_key')} help={t('attribute_internal_key_hint')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('attribute_internal_key_placeholder')}
            value={key}
            onChangeText={handleKeyChange}
            autoCapitalize="none"
            editable={!isEditing}
            style={[commonInputStyles.input, isEditing && { opacity: 0.6 }]}
          />
        )}
      </FormField>

      <FormField label={t('description')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('attribute_description_placeholder')}
            value={description || ''}
            onChangeText={setDescription}
            style={[commonInputStyles.multiline, { minHeight: 3 * 20 }]}
            multiline
          />
        )}
      </FormField>

      <FormField label={t('attribute_type_label')}>
        <SingleSelectPill
          options={typeOptions}
          value={type}
          onValueChange={(value) => setType((value as AttributeType) || AttributeType.TEXT)}
          placeholder={t('attribute_type_label')}
          disabled={isEditing}
        />
      </FormField>

      {type === AttributeType.ENTITY && (
        <FormField
          label={t('attribute_target_entity_type')}
          help={t('attribute_target_entity_type_hint')}
        >
          <SingleSelectPill
            options={targetEntityTypeOptions}
            value={targetEntityType}
            onValueChange={(value) => setTargetEntityType((value as StorySchemaEntityType) || null)}
            placeholder={t('attribute_target_entity_type')}
            disabled={isEditing}
          />
        </FormField>
      )}

      <FormSwitchField
        label={t('attribute_required')}
        value={isRequired}
        onValueChange={setIsRequired}
      />

      {type !== AttributeType.ENTITY && (
        <FormField label={t('attribute_default_value')}>
          <AttributeValueInput
            type={type}
            value={defaultValue || ''}
            onChange={setDefaultValue}
            placeholder={t('attribute_default_value')}
            storyId={storyId}
            suggestionFieldId={initialFieldId}
          />
        </FormField>
      )}
    </EntityFormContainer>
  );
};

export default StorySchemaFieldFormScreen;
