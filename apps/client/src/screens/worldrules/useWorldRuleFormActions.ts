import type { SeeAlsoManagerHandle } from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import { validateRequiredCustomAttributes } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import { useAsyncOperation } from '@/src/hooks/useAsyncOperation';
import type { WorldRule } from '@keres/shared/entities/WorldRule';
import type { StorySchemaField } from '@keres/shared';
import { StackActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RefObject } from 'react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppDrizzleClient } from '../../db';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import type { WorldRulesStackParamList } from '../../navigation/MainSystemStack';
import { createAttributeValueService } from '../../services/storymanagement/AttributeValueService';
import { saveEntityWithSecondaryData } from '../../services/storymanagement/EntityFormSaveCoordinator';
import type { WorldRuleService } from '../../services/storymanagement/WorldRuleService';
import { AppAlert } from '../../utils/AppAlert';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { useVocabularyEntityCopy } from '../../vocabulary/useVocabularyEntityCopy';
import type { WorldRuleFormState } from './useWorldRuleFormState';

type WorldRuleNavigation = NativeStackNavigationProp<WorldRulesStackParamList, 'WorldRuleForm'>;

type UseWorldRuleFormActionsOptions = {
  state: WorldRuleFormState;
  customFields: StorySchemaField[];
  drizzleDb: AppDrizzleClient;
  worldRuleServiceRef: RefObject<WorldRuleService | null>;
  navigation: WorldRuleNavigation;
  storyId?: string;
  userId?: string | null;
  persistTagRelations(worldRuleId: string): Promise<void>;
  persistNoteRelations(worldRuleId: string): Promise<void>;
};

/** Owns validation, persistence, feedback, events and navigation for the WorldRule form. */
export function useWorldRuleFormActions({
  state,
  customFields,
  drizzleDb,
  worldRuleServiceRef,
  navigation,
  storyId,
  userId,
  persistTagRelations,
  persistNoteRelations,
}: UseWorldRuleFormActionsOptions) {
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('WorldRule');
  const confirmDelete = useConfirmDelete();
  const seeAlsoManagerRef = useRef<SeeAlsoManagerHandle>(null);
  const { pending: saving, run: runSave } = useAsyncOperation();
  const [deleting, setDeleting] = useState(false);

  const handleSave = () =>
    runSave(async () => {
      if (!state.title.trim()) {
        AppAlert.alert(t('error'), copy.required);
        return;
      }
      const missingRequiredField = validateRequiredCustomAttributes(
        customFields,
        state.customValues,
      );
      if (missingRequiredField) {
        AppAlert.alert(t('error'), t('custom_attribute_required', { field: missingRequiredField }));
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
      if (!worldRuleServiceRef.current) {
        AppAlert.alert(t('error'), copy.failedToSave);
        return;
      }

      try {
        const worldRuleData: Omit<
          WorldRule,
          'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
        > = {
          title: state.title.trim(),
          description: state.description,
          section: state.section,
          type: state.type,
          category: state.category,
          behavior: state.behavior,
          usability: state.usability,
          danger: state.danger,
          isFavorite: state.isFavorite,
          extraNotes: state.extraNotes,
        };

        const { entityId: savedWorldRuleId, created } = await saveEntityWithSecondaryData({
          currentEntityId: state.currentWorldRuleId,
          createEntity: () =>
            worldRuleServiceRef.current!.createWorldRule(userId, {
              ...worldRuleData,
              storyId,
            }),
          updateEntity: (worldRuleId) =>
            worldRuleServiceRef.current!.updateWorldRule(userId, worldRuleId, worldRuleData),
          onEntityPersisted: state.retainPersistedWorldRuleId,
          persistSecondaryData: async (worldRuleId) => {
            await persistTagRelations(worldRuleId);
            await persistNoteRelations(worldRuleId);
            await seeAlsoManagerRef.current?.persistPending(worldRuleId);
            await createAttributeValueService(drizzleDb).saveValuesForEntity(
              userId,
              storyId,
              'WorldRule',
              worldRuleId,
              state.customValues,
            );
          },
        });

        entityEventEmitter.emit('worldrule_changed', storyId, savedWorldRuleId);
        AppAlert.alert(t('success'), created ? copy.created : copy.updated);

        if (created) {
          navigation.dispatch(
            StackActions.replace('WorldRuleForm', { worldRuleId: savedWorldRuleId }),
          );
        } else {
          navigation.goBack();
        }
      } catch (err) {
        console.error('Failed to save world rule:', err);
        AppAlert.alert(t('error'), copy.failedToSave);
      }
    });

  const handleDelete = () => {
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }

    if (!state.currentWorldRuleId || !worldRuleServiceRef.current) {
      return;
    }

    const worldRuleId = state.currentWorldRuleId;
    confirmDelete({
      titleKey: 'delete_world_rule_title',
      title: copy.deleteLabel,
      messageKey: 'delete_world_rule_message',
      message: copy.deleteMessage,
      successMessage: copy.deleted,
      failureKey: 'failed_to_delete_world_rule',
      failureMessage: copy.failedToDelete,
      onLoadingChange: setDeleting,
      onConfirm: async () => {
        await worldRuleServiceRef.current!.deleteWorldRule(userId, worldRuleId);
        entityEventEmitter.emit('worldrule_changed', storyId, worldRuleId);
        navigation.goBack();
      },
    });
  };

  return { deleting, handleDelete, handleSave, saving, seeAlsoManagerRef };
}
