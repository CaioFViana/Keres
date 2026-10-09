import type { SeeAlsoManagerHandle } from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import { useEntityFormActions } from '@/src/hooks/useEntityFormActions';
import type { Item } from '@keres/shared/entities/Item';
import type { StorySchemaField } from '@keres/shared';
import { StackActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RefObject } from 'react';
import { useRef } from 'react';
import type { AppDrizzleClient } from '../../db';
import type { ItemStackParamList } from '../../navigation/MainSystemStack';
import type { ItemService } from '../../services/storymanagement/ItemService';
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
  persistSecondaryDraft?(itemId: string): Promise<void>;
  clearSecondaryDraft?(itemId: string): Promise<void>;
};

type ItemData = Omit<
  Item,
  'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
>;

/** What differs for the Item form: its fields, service calls, secondary writes, texts and navigation. */
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
  persistSecondaryDraft,
  clearSecondaryDraft,
}: UseItemFormActionsOptions) {
  const copy = useVocabularyEntityCopy('Item');
  const seeAlsoManagerRef = useRef<SeeAlsoManagerHandle>(null);
  const service = () => itemServiceRef.current!;

  const actions = useEntityFormActions<ItemData, { id: string }>({
    entityType: 'Item',
    changeEvent: 'item_changed',
    storyId,
    userId,
    drizzleDb,
    customFields,
    customValues: state.customValues,
    currentEntityId: state.currentItemId,
    isServiceReady: () => !!itemServiceRef.current,
    clearFormDraft: state.clearFormDraft,
    retainPersistedId: state.retainPersistedItemId,
    validate: () => (state.name.trim() ? null : copy.required),
    buildData: () => ({
      name: state.name.trim(),
      category: state.category,
      description: state.description,
      initialState: state.initialState,
      isFavorite: state.isFavorite,
      extraNotes: state.extraNotes,
      characterOwnerId: state.characterOwnerId,
    }),
    create: (currentUserId, currentStoryId, data) =>
      service().createItem(currentUserId, { ...data, storyId: currentStoryId }),
    update: (currentUserId, itemId, data) => service().updateItem(currentUserId, itemId, data),
    remove: (currentUserId, itemId) => service().deleteItem(currentUserId, itemId),
    secondarySteps: [
      persistTagRelations,
      persistNoteRelations,
      (itemId) => seeAlsoManagerRef.current?.persistPending(itemId) ?? Promise.resolve(),
    ],
    persistSecondaryDraft,
    clearSecondaryDraft,
    messages: {
      failedToSave: copy.failedToSave,
      created: copy.created,
      updated: copy.updated,
    },
    confirmDelete: {
      titleKey: 'delete_item_title',
      title: copy.deleteLabel,
      messageKey: 'delete_item_message',
      message: copy.deleteMessage,
      successMessage: copy.deleted,
      failureKey: 'failed_to_delete_item',
      failureMessage: copy.failedToDelete,
    },
    afterSave: (itemId, created) => {
      if (created) {
        navigation.dispatch(StackActions.replace('ItemForm', { itemId }));
      } else {
        navigation.goBack();
      }
    },
    afterDelete: () => navigation.goBack(),
    logName: 'item',
  });

  return { ...actions, seeAlsoManagerRef };
}
