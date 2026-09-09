import type { StorySchemaEntityType } from '@keres/shared';
import { AttributeKeyRegex, AttributeType } from '@keres/shared';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RefObject } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CustomizationStackParamList } from '../../navigation/MainSystemStack';
import type { StorySchemaFieldService } from '../../services/storymanagement/StorySchemaFieldService';
import { AppAlert } from '../../utils/AppAlert';
import type { StorySchemaFieldFormState } from './useStorySchemaFieldFormState';

type StorySchemaFieldNavigation = NativeStackNavigationProp<
  CustomizationStackParamList,
  'StorySchemaFieldForm'
>;

type UseStorySchemaFieldFormActionsOptions = {
  state: StorySchemaFieldFormState;
  storySchemaFieldServiceRef: RefObject<StorySchemaFieldService | null>;
  navigation: StorySchemaFieldNavigation;
  storyId?: string;
  userId?: string | null;
  entityType: StorySchemaEntityType;
  initialFieldId?: string;
  existingFieldCount: number;
};

/** Owns validation, persistence, feedback and navigation for the StorySchemaField form. */
export function useStorySchemaFieldFormActions({
  state,
  storySchemaFieldServiceRef,
  navigation,
  storyId,
  userId,
  entityType,
  initialFieldId,
  existingFieldCount,
}: UseStorySchemaFieldFormActionsOptions) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!state.name.trim()) {
      AppAlert.alert(t('error'), t('display_name_required'));
      return;
    }
    if (!AttributeKeyRegex.test(state.key)) {
      AppAlert.alert(t('error'), t('invalid_attribute_key'));
      return;
    }
    if (state.type === AttributeType.ENTITY && !state.targetEntityType) {
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
    if (!storySchemaFieldServiceRef.current) {
      AppAlert.alert(t('error'), t('failed_to_save_attribute'));
      return;
    }

    setSaving(true);
    try {
      const service = storySchemaFieldServiceRef.current;
      if (state.isEditing) {
        await service.updateField(userId, initialFieldId!, {
          name: state.name.trim(),
          description: state.description?.trim() || null,
          isRequired: state.isRequired,
          defaultValue:
            state.type === AttributeType.ENTITY ? null : state.defaultValue?.trim() || null,
        });
      } else {
        await service.createField(userId, {
          storyId,
          entityType,
          name: state.name.trim(),
          key: state.key,
          description: state.description?.trim() || null,
          type: state.type,
          targetEntityType: state.type === AttributeType.ENTITY ? state.targetEntityType : null,
          isRequired: state.isRequired,
          defaultValue:
            state.type === AttributeType.ENTITY ? null : state.defaultValue?.trim() || null,
          order: existingFieldCount,
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

  return { handleSave, saving };
}
