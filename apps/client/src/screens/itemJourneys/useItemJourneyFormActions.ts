import type { SeeAlsoManagerHandle } from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import { useAsyncOperation } from '@/src/hooks/useAsyncOperation';
import type { ItemJourney } from '@keres/shared/entities/Item';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StackActions } from '@react-navigation/native';
import type { RefObject } from 'react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import type { ItemStackParamList } from '../../navigation/MainSystemStack';
import { saveEntityWithSecondaryData } from '../../services/storymanagement/EntityFormSaveCoordinator';
import type { ItemJourneyService } from '../../services/storymanagement/ItemJourneyService';
import { AppAlert } from '../../utils/AppAlert';
import { entityEventEmitter } from '../../utils/EventEmitter';
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

/** Owns validation, persistence, feedback, events and navigation for the ItemJourney form. */
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
  const confirmDelete = useConfirmDelete();
  const seeAlsoManagerRef = useRef<SeeAlsoManagerHandle>(null);
  const { pending: saving, run: runSave } = useAsyncOperation();
  const [deleting, setDeleting] = useState(false);

  const handleSave = () =>
    runSave(async () => {
      if (!state.itemId) {
        AppAlert.alert(t('error'), itemCopy.required);
        return;
      }
      if (!state.sceneId) {
        AppAlert.alert(t('error'), t('scene_required'));
        return;
      }
      if (!state.newState.trim()) {
        AppAlert.alert(t('error'), t('new_state_required'));
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
      if (!itemJourneyServiceRef.current) {
        AppAlert.alert(t('error'), t('vocabulary_failed_to_save_entity', { entity: journey }));
        return;
      }

      try {
        const itemJourneyData: Omit<
          ItemJourney,
          'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
        > = {
          storyId,
          itemId: state.itemId,
          sceneId: state.sceneId,
          newCharacterOwnerId: state.newCharacterOwnerId,
          newState: state.newState.trim(),
          extraNotes: state.extraNotes,
        };

        const { entityId: savedItemJourneyId, created } = await saveEntityWithSecondaryData({
          currentEntityId: state.currentItemJourneyId,
          createEntity: () =>
            itemJourneyServiceRef.current!.createItemJourney(userId, itemJourneyData),
          updateEntity: (itemJourneyId) =>
            itemJourneyServiceRef.current!.updateItemJourney(
              userId,
              itemJourneyId,
              itemJourneyData,
            ),
          onEntityPersisted: state.retainPersistedItemJourneyId,
          persistSecondaryDraft,
          clearSecondaryDraft,
          persistSecondaryData: async (itemJourneyId) => {
            await persistTagRelations(itemJourneyId);
            await persistNoteRelations(itemJourneyId);
            await seeAlsoManagerRef.current?.persistPending(itemJourneyId);
          },
        });

        entityEventEmitter.emit('item_journey_changed', storyId, savedItemJourneyId);
        AppAlert.alert(
          t('success'),
          t(created ? 'vocabulary_entity_created' : 'vocabulary_entity_updated', {
            entity: journey,
            ending: 'a',
          }),
        );

        if (created) {
          navigation.dispatch(
            StackActions.replace('ItemJourneyForm', { itemJourneyId: savedItemJourneyId }),
          );
        } else {
          navigation.goBack();
        }
      } catch (err) {
        console.error('Failed to save item journey:', err);
        AppAlert.alert(t('error'), t('vocabulary_failed_to_save_entity', { entity: journey }));
      }
    });

  const handleDelete = () => {
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }

    if (!state.currentItemJourneyId || !itemJourneyServiceRef.current) {
      return;
    }

    const itemJourneyId = state.currentItemJourneyId;
    confirmDelete({
      titleKey: 'delete_item_journey_title',
      title: t('vocabulary_delete_entity', { entity: journey }),
      messageKey: 'delete_item_journey_message',
      message: t('vocabulary_delete_entity_message', { entity: journey }),
      successMessage: t('vocabulary_entity_deleted', { entity: journey, ending: 'a' }),
      failureKey: 'failed_to_delete_item_journey',
      failureMessage: t('vocabulary_failed_to_delete_entity', { entity: journey }),
      onLoadingChange: setDeleting,
      onConfirm: async () => {
        await itemJourneyServiceRef.current!.deleteItemJourney(userId, itemJourneyId);
        entityEventEmitter.emit('item_journey_changed', storyId, itemJourneyId);
        navigation.goBack();
      },
    });
  };

  return { deleting, handleDelete, handleSave, saving, seeAlsoManagerRef };
}
