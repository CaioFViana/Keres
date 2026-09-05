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
import {
  AttributeKeyRegex,
  AttributeType,
  deriveAttributeKey,
  STORY_SCHEMA_ENTITY_TYPES,
} from '@keres/shared';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useStorySchemaFields } from '../../hooks/useStorySchemaFields';
import type { CustomizationStackParamList } from '../../navigation/MainSystemStack';
import { createStorySchemaFieldService } from '../../services/storymanagement/StorySchemaFieldService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { commonFormStyleDefs, getCommonInputStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';

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
  const { entityType, fieldId } = route.params;
  const { selectedStory } = useStoryStore();
  const storyId = selectedStory?.id;
  const drizzleDb = useDrizzle();
  const { userId } = useUserSettingsStore();

  const commonInputStyles = getCommonInputStyles(colors);

  const isEditing = !!fieldId;

  const existingFields = useStorySchemaFields(storyId, entityType);

  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(false);
  const [description, setDescription] = useState<string | null>(null);
  const [type, setType] = useState<AttributeType>(AttributeType.TEXT);
  const [targetEntityType, setTargetEntityType] = useState<StorySchemaEntityType | null>(null);
  const [isRequired, setIsRequired] = useState(false);
  const [defaultValue, setDefaultValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  useScreenHeader({
    target: 'parent',
    title: isEditing ? t('edit_attribute_title') : t('create_attribute_title'),
  });

  useEffect(() => {
    if (!isEditing) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const service = createStorySchemaFieldService(drizzleDb);
        const field = await service.getById(fieldId!);
        if (field) {
          setName(field.name);
          setKey(field.key);
          setKeyManuallyEdited(true); // The key is already fixed in editing mode; there is nothing left to auto-derive.
          setDescription(field.description);
          setType(field.type as AttributeType);
          setTargetEntityType(field.targetEntityType as StorySchemaEntityType | null);
          setIsRequired(field.isRequired);
          setDefaultValue(field.defaultValue);
        } else {
          AppAlert.alert(t('error'), t('attribute_not_found'));
          navigation.goBack();
        }
      } catch (err) {
        console.error('Failed to load attribute field:', err);
        AppAlert.alert(t('error'), t('failed_to_load_attribute'));
      } finally {
        setLoading(false);
      }
    })();
  }, [isEditing, fieldId, drizzleDb, navigation, t]);

  const handleNameChange = (text: string) => {
    setName(text);
    if (!keyManuallyEdited) {
      setKey(deriveAttributeKey(text));
    }
  };

  const handleKeyChange = (text: string) => {
    setKeyManuallyEdited(true);
    setKey(text.toLowerCase());
  };

  const handleSave = async () => {
    if (!name.trim()) {
      AppAlert.alert(t('error'), t('display_name_required'));
      return;
    }
    if (!AttributeKeyRegex.test(key)) {
      AppAlert.alert(t('error'), t('invalid_attribute_key'));
      return;
    }
    if (type === AttributeType.ENTITY && !targetEntityType) {
      AppAlert.alert(t('error'), t('attribute_target_entity_type_required'));
      return;
    }
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }
    if (!storyId) {
      AppAlert.alert(t('error'), t('no_story_selected'));
      return;
    }

    setSaving(true);
    try {
      const service = createStorySchemaFieldService(drizzleDb);
      if (isEditing) {
        await service.updateField(userId, fieldId!, {
          name: name.trim(),
          description: description?.trim() || null,
          isRequired,
          defaultValue: type === AttributeType.ENTITY ? null : defaultValue?.trim() || null,
        });
      } else {
        await service.createField(userId, {
          storyId,
          entityType,
          name: name.trim(),
          key,
          description: description?.trim() || null,
          type,
          targetEntityType: type === AttributeType.ENTITY ? targetEntityType : null,
          isRequired,
          defaultValue: type === AttributeType.ENTITY ? null : defaultValue?.trim() || null,
          order: existingFields.length,
        });
      }
      navigation.goBack();
    } catch (err: any) {
      console.error('Failed to save attribute field:', err);
      AppAlert.alert(t('error'), err?.message || t('failed_to_save_attribute'));
    } finally {
      setSaving(false);
    }
  };

  const typeOptions = ATTRIBUTE_TYPE_OPTIONS.map((value) => ({
    label: t(`attribute_type_${value}`),
    value,
  }));
  const targetEntityTypeOptions = STORY_SCHEMA_ENTITY_TYPES.map((value) => ({
    label: t(`${value.toLowerCase()}s`),
    value,
  }));

  const styles = StyleSheet.create({
    ...commonFormStyleDefs(colors),
    hint: { fontSize: 13, color: colors.textSecondary, marginTop: -2, marginBottom: 5 },
    saveButton: { marginTop: 30 },
  });

  if (loading) {
    return <ScreenLoading message={t('loading')} />;
  }

  return (
    <EntityFormContainer>
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

      <Text style={styles.label}>{t('attribute_internal_key')}</Text>
      <Text style={styles.hint}>{t('attribute_internal_key_hint')}</Text>
      <TextInput
        placeholder={t('attribute_internal_key_placeholder')}
        value={key}
        onChangeText={handleKeyChange}
        autoCapitalize="none"
        editable={!isEditing}
        style={[commonInputStyles.input, isEditing && { opacity: 0.6 }]}
      />

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
        <>
          <Text style={styles.label}>{t('attribute_target_entity_type')}</Text>
          <Text style={styles.hint}>{t('attribute_target_entity_type_hint')}</Text>
          <SingleSelectPill
            options={targetEntityTypeOptions}
            value={targetEntityType}
            onValueChange={(value) => setTargetEntityType((value as StorySchemaEntityType) || null)}
            placeholder={t('attribute_target_entity_type')}
            disabled={isEditing}
          />
        </>
      )}

      <FormSwitchField
        label={t('attribute_required')}
        value={isRequired}
        onValueChange={setIsRequired}
      />

      {type !== AttributeType.ENTITY && (
        <>
          <Text style={styles.label}>{t('attribute_default_value')}</Text>
          <AttributeValueInput
            type={type}
            value={defaultValue || ''}
            onChange={setDefaultValue}
            placeholder={t('attribute_default_value')}
            storyId={storyId}
            suggestionFieldId={fieldId}
          />
        </>
      )}

      <Button onPress={handleSave} style={styles.saveButton} disabled={saving}>
        {saving ? t('saving') : t('save')}
      </Button>
    </EntityFormContainer>
  );
};

export default StorySchemaFieldFormScreen;
