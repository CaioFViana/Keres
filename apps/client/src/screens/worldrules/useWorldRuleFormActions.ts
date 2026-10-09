import type { SeeAlsoManagerHandle } from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import { useEntityFormActions } from '@/src/hooks/useEntityFormActions';
import type { WorldRule } from '@keres/shared/entities/WorldRule';
import type { StorySchemaField } from '@keres/shared';
import { StackActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RefObject } from 'react';
import { useRef } from 'react';
import type { AppDrizzleClient } from '../../db';
import type { WorldRulesStackParamList } from '../../navigation/MainSystemStack';
import type { WorldRuleService } from '../../services/storymanagement/WorldRuleService';
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
  persistSecondaryDraft?(worldRuleId: string): Promise<void>;
  clearSecondaryDraft?(worldRuleId: string): Promise<void>;
};

type WorldRuleData = Omit<
  WorldRule,
  'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
>;

/** What differs for the WorldRule form: its fields, service calls, secondary writes, texts and navigation. */
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
  persistSecondaryDraft,
  clearSecondaryDraft,
}: UseWorldRuleFormActionsOptions) {
  const copy = useVocabularyEntityCopy('WorldRule');
  const seeAlsoManagerRef = useRef<SeeAlsoManagerHandle>(null);
  const service = () => worldRuleServiceRef.current!;

  const actions = useEntityFormActions<WorldRuleData, { id: string }>({
    entityType: 'WorldRule',
    changeEvent: 'worldrule_changed',
    storyId,
    userId,
    drizzleDb,
    customFields,
    customValues: state.customValues,
    currentEntityId: state.currentWorldRuleId,
    isServiceReady: () => !!worldRuleServiceRef.current,
    clearFormDraft: state.clearFormDraft,
    retainPersistedId: state.retainPersistedWorldRuleId,
    validate: () => (state.title.trim() ? null : copy.required),
    buildData: () => ({
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
    }),
    create: (currentUserId, currentStoryId, data) =>
      service().createWorldRule(currentUserId, { ...data, storyId: currentStoryId }),
    update: (currentUserId, worldRuleId, data) =>
      service().updateWorldRule(currentUserId, worldRuleId, data),
    remove: (currentUserId, worldRuleId) => service().deleteWorldRule(currentUserId, worldRuleId),
    secondarySteps: [
      persistTagRelations,
      persistNoteRelations,
      (worldRuleId) => seeAlsoManagerRef.current?.persistPending(worldRuleId) ?? Promise.resolve(),
    ],
    persistSecondaryDraft,
    clearSecondaryDraft,
    messages: {
      failedToSave: copy.failedToSave,
      created: copy.created,
      updated: copy.updated,
    },
    confirmDelete: {
      titleKey: 'delete_world_rule_title',
      title: copy.deleteLabel,
      messageKey: 'delete_world_rule_message',
      message: copy.deleteMessage,
      successMessage: copy.deleted,
      failureKey: 'failed_to_delete_world_rule',
      failureMessage: copy.failedToDelete,
    },
    afterSave: (worldRuleId, created) => {
      if (created) {
        navigation.dispatch(StackActions.replace('WorldRuleForm', { worldRuleId }));
      } else {
        navigation.goBack();
      }
    },
    afterDelete: () => navigation.goBack(),
    logName: 'world rule',
  });

  return { ...actions, seeAlsoManagerRef };
}
