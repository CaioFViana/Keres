import type { SeeAlsoManagerHandle } from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import { useEntityFormActions } from '@/src/hooks/useEntityFormActions';
import type { ItemJourney } from '@keres/shared/entities/Item';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StackActions } from '@react-navigation/native';
import type { RefObject } from 'react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ItemStackParamList } from '../../navigation/MainSystemStack';
import type { ItemJourneyService } from '../../services/storymanagement/ItemJourneyService';
import { useVocabularyEntityCopy } from '../../vocabulary/useVocabularyEntityCopy';
import type { ItemJourneyFormState } from './useItemJourneyFormState';

type ItemJourneyNavigation = NativeStackNavigationProp<ItemStackParamList, 'ItemJourneyForm'>;

type UseItemJourneyFormActionsOptions = {
  state: ItemJourneyFormState;
  itemJourneyServiceRef: RefObject<ItemJourneyService | null>;
  navigation: ItemJourneyNavigation;
  storyId?: string;
  userId?: string | null;
  persistTagRelations(itemJourneyId: string): Promise<void>;
  persistNoteRelations(itemJourneyId: string): Promise<void>;
  persistSecondaryDraft?(itemJourneyId: string): Promise<void>;
  clearSecondaryDraft?(itemJourneyId: string): Promise<void>;
};

type ItemJourneyData = Omit<
  ItemJourney,
  'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
>;

/** What differs for the ItemJourney form: its fields, service calls, secondary writes, texts and navigation. */
export function useItemJourneyFormActions({
  state,
  itemJourneyServiceRef,
  navigation,
  storyId,
  userId,
  persistTagRelations,
  persistNoteRelations,
  persistSecondaryDraft,
  clearSecondaryDraft,
}: UseItemJourneyFormActionsOptions) {
  const { t } = useTranslation();
  const itemCopy = useVocabularyEntityCopy('Item');
  const journey = itemCopy.itemJourney;
  const seeAlsoManagerRef = useRef<SeeAlsoManagerHandle>(null);
  const service = () => itemJourneyServiceRef.current!;

  const actions = useEntityFormActions<ItemJourneyData, { id: string }>({
    changeEvent: 'item_journey_changed',
    storyId,
    userId,
    currentEntityId: state.currentItemJourneyId,
    isServiceReady: () => !!itemJourneyServiceRef.current,
    clearFormDraft: state.clearFormDraft,
    retainPersistedId: state.retainPersistedItemJourneyId,
    validate: () => {
      if (!state.itemId) return itemCopy.required;
      if (!state.sceneId) return t('scene_required');
      if (!state.newState.trim()) return t('new_state_required');
      return null;
    },
    // The journey carries its story id in its own data, so it is not added again on create.
    buildData: () => ({
      storyId: storyId!,
      itemId: state.itemId!,
      sceneId: state.sceneId!,
      newCharacterOwnerId: state.newCharacterOwnerId,
      newState: state.newState.trim(),
      extraNotes: state.extraNotes,
    }),
    create: (currentUserId, _storyId, data) => service().createItemJourney(currentUserId, data),
    update: (currentUserId, journeyId, data) =>
      service().updateItemJourney(currentUserId, journeyId, data),
    remove: (currentUserId, journeyId) => service().deleteItemJourney(currentUserId, journeyId),
    secondarySteps: [
      persistTagRelations,
      persistNoteRelations,
      (journeyId) => seeAlsoManagerRef.current?.persistPending(journeyId) ?? Promise.resolve(),
    ],
    persistSecondaryDraft,
    clearSecondaryDraft,
    messages: {
      failedToSave: t('vocabulary_failed_to_save_entity', { entity: journey }),
      created: t('vocabulary_entity_created', { entity: journey, ending: 'a' }),
      updated: t('vocabulary_entity_updated', { entity: journey, ending: 'a' }),
    },
    confirmDelete: {
      titleKey: 'delete_item_journey_title',
      title: t('vocabulary_delete_entity', { entity: journey }),
      messageKey: 'delete_item_journey_message',
      message: t('vocabulary_delete_entity_message', { entity: journey }),
      successMessage: t('vocabulary_entity_deleted', { entity: journey, ending: 'a' }),
      failureKey: 'failed_to_delete_item_journey',
      failureMessage: t('vocabulary_failed_to_delete_entity', { entity: journey }),
    },
    afterSave: (itemJourneyId, created) => {
      if (created) {
        navigation.dispatch(StackActions.replace('ItemJourneyForm', { itemJourneyId }));
      } else {
        navigation.goBack();
      }
    },
    afterDelete: () => navigation.goBack(),
    logName: 'item journey',
  });

  return { ...actions, seeAlsoManagerRef };
}
