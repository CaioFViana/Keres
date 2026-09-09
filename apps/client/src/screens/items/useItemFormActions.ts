import type { SeeAlsoManagerHandle } from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import { validateRequiredCustomAttributes } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import { useAsyncOperation } from '@/src/hooks/useAsyncOperation';
import type { Item } from '@keres/shared/entities/Item';
import type { StorySchemaField } from '@keres/shared';
import { StackActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RefObject } from 'react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppDrizzleClient } from '../../db';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import type { ItemStackParamList } from '../../navigation/MainSystemStack';
import { createAttributeValueService } from '../../services/storymanagement/AttributeValueService';
import { saveEntityWithSecondaryData } from '../../services/storymanagement/EntityFormSaveCoordinator';
import type { ItemService } from '../../services/storymanagement/ItemService';
import { AppAlert } from '../../utils/AppAlert';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { useVocabularyEntityCopy } from '../../vocabulary/useVocabularyEntityCopy';
import type { ItemFormState } from './useItemFormState';

type ItemNavigation = NativeStackNavigationProp<ItemStackParamList, 'ItemForm'>;

type UseItemFormActionsOptions = {
  state: ItemFormState;
  customFields: StorySchemaField[];
  drizzleDb: AppDrizzleClient;
  itemServiceRef: RefObject<ItemService | null>;
  navigation: ItemNavigation;
  storyId?: string;
  userId?: string | null;
  persistTagRelations(itemId: string): Promise<void>;
  persistNoteRelations(itemId: string): Promise<void>;
};

/** Owns validation, persistence, feedback, events and navigation for the Item form. */
export function useItemFormActions({
  state,
  customFields,
  drizzleDb,
  itemServiceRef,
  navigation,
  storyId,
  userId,
  persistTagRelations,
  persistNoteRelations,
}: UseItemFormActionsOptions) {
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('Item');
  const confirmDelete = useConfirmDelete();
  const seeAlsoManagerRef = useRef<SeeAlsoManagerHandle>(null);
  const { pending: saving, run: runSave } = useAsyncOperation();
  const [deleting, setDeleting] = useState(false);

  const handleSave = () =>
    runSave(async () => {
      if (!state.name.trim()) {
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
      if (!itemServiceRef.current) {
        AppAlert.alert(t('error'), copy.failedToSave);
        return;
      }

      try {
        const itemData: Omit<
          Item,
          'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
        > = {
          name: state.name.trim(),
          category: state.category,
          description: state.description,
          initialState: state.initialState,
          isFavorite: state.isFavorite,
          extraNotes: state.extraNotes,
          characterOwnerId: state.characterOwnerId,
        };

        const { entityId: savedItemId, created } = await saveEntityWithSecondaryData({
          currentEntityId: state.currentItemId,
          createEntity: () =>
            itemServiceRef.current!.createItem(userId, {
              ...itemData,
              storyId,
            }),
          updateEntity: (itemId) => itemServiceRef.current!.updateItem(userId, itemId, itemData),
          onEntityPersisted: state.retainPersistedItemId,
          persistSecondaryData: async (itemId) => {
            await persistTagRelations(itemId);
            await persistNoteRelations(itemId);
            await seeAlsoManagerRef.current?.persistPending(itemId);
            await createAttributeValueService(drizzleDb).saveValuesForEntity(
              userId,
              storyId,
              'Item',
              itemId,
              state.customValues,
            );
          },
        });

        entityEventEmitter.emit('item_changed', storyId, savedItemId);
        AppAlert.alert(t('success'), created ? copy.created : copy.updated);

        if (created) {
          navigation.dispatch(StackActions.replace('ItemForm', { itemId: savedItemId }));
        } else {
          navigation.goBack();
        }
      } catch (err) {
        console.error('Failed to save item:', err);
        AppAlert.alert(t('error'), copy.failedToSave);
      }
    });

  const handleDelete = () => {
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }

    if (!state.currentItemId || !itemServiceRef.current) {
      return;
    }

    const itemId = state.currentItemId;
    confirmDelete({
      titleKey: 'delete_item_title',
      title: copy.deleteLabel,
      messageKey: 'delete_item_message',
      message: copy.deleteMessage,
      successMessage: copy.deleted,
      failureKey: 'failed_to_delete_item',
      failureMessage: copy.failedToDelete,
      onLoadingChange: setDeleting,
      onConfirm: async () => {
        await itemServiceRef.current!.deleteItem(userId, itemId);
        entityEventEmitter.emit('item_changed', storyId, itemId);
        navigation.goBack();
      },
    });
  };

  return { deleting, handleDelete, handleSave, saving, seeAlsoManagerRef };
}
