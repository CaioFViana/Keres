import type { SeeAlsoManagerHandle } from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import { validateRequiredCustomAttributes } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import { useAsyncOperation } from '@/src/hooks/useAsyncOperation';
import type { Location } from '@keres/shared/entities/Location';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StackActions } from '@react-navigation/native';
import type { StorySchemaField } from '@keres/shared';
import type { RefObject } from 'react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppDrizzleClient } from '../../db';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import type { LocationStackParamList } from '../../navigation/MainSystemStack';
import { createAttributeValueService } from '../../services/storymanagement/AttributeValueService';
import { saveEntityWithSecondaryData } from '../../services/storymanagement/EntityFormSaveCoordinator';
import type { LocationService } from '../../services/storymanagement/LocationService';
import { AppAlert } from '../../utils/AppAlert';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { useVocabularyEntityCopy } from '../../vocabulary/useVocabularyEntityCopy';
import type { LocationFormState } from './useLocationFormState';

type LocationNavigation = NativeStackNavigationProp<LocationStackParamList, 'LocationForm'>;

type UseLocationFormActionsOptions = {
  state: LocationFormState;
  customFields: StorySchemaField[];
  drizzleDb: AppDrizzleClient;
  locationServiceRef: RefObject<LocationService | null>;
  navigation: LocationNavigation;
  storyId?: string;
  userId?: string | null;
  persistTagRelations(locationId: string): Promise<void>;
  persistNoteRelations(locationId: string): Promise<void>;
  persistPendingLocationRelations(locationId: string): Promise<void>;
  persistSecondaryDraft?(locationId: string): Promise<void>;
  clearSecondaryDraft?(locationId: string): Promise<void>;
};

/** Owns validation, persistence, feedback, events and navigation for the Location form. */
export function useLocationFormActions({
  state,
  customFields,
  drizzleDb,
  locationServiceRef,
  navigation,
  storyId,
  userId,
  persistTagRelations,
  persistNoteRelations,
  persistPendingLocationRelations,
  persistSecondaryDraft,
  clearSecondaryDraft,
}: UseLocationFormActionsOptions) {
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('Location');
  const confirmDelete = useConfirmDelete();
  const seeAlsoManagerRef = useRef<SeeAlsoManagerHandle>(null);
  const { pending: saving, run: runSave } = useAsyncOperation();
  const [deleting, setDeleting] = useState(false);

  const handleSave = () =>
    runSave(async () => {
      if (!state.name.trim()) {
        AppAlert.alert(t('error'), t('name_required'));
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
      if (!locationServiceRef.current) {
        AppAlert.alert(t('error'), copy.failedToSave);
        return;
      }

      try {
        const locationData: Omit<
          Location,
          'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
        > = {
          name: state.name.trim(),
          description: state.description,
          climate: state.climate,
          culture: state.culture,
          politics: state.politics,
          isFavorite: state.isFavorite,
          extraNotes: state.extraNotes,
        };

        const { entityId: savedLocationId, created } = await saveEntityWithSecondaryData({
          currentEntityId: state.currentLocationId,
          createEntity: () =>
            locationServiceRef.current!.createLocation(userId, {
              ...locationData,
              storyId,
            }),
          updateEntity: (locationId) =>
            locationServiceRef.current!.updateLocation(userId, locationId, locationData),
          onEntityPersisted: state.retainPersistedLocationId,
          persistSecondaryDraft,
          clearSecondaryDraft,
          persistSecondaryData: async (locationId) => {
            await persistTagRelations(locationId);
            await persistNoteRelations(locationId);
            await seeAlsoManagerRef.current?.persistPending(locationId);
            await persistPendingLocationRelations(locationId);
            await createAttributeValueService(drizzleDb).saveValuesForEntity(
              userId,
              storyId,
              'Location',
              locationId,
              state.customValues,
            );
          },
        });

        entityEventEmitter.emit('location_changed', storyId, savedLocationId);
        AppAlert.alert(t('success'), created ? copy.created : copy.updated);

        if (created) {
          navigation.dispatch(
            StackActions.replace('LocationForm', { locationId: savedLocationId }),
          );
        } else {
          navigation.goBack();
        }
      } catch (err) {
        console.error('Failed to save location:', err);
        AppAlert.alert(t('error'), copy.failedToSave);
      }
    });

  const handleDelete = () => {
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }

    if (!state.currentLocationId || !locationServiceRef.current) {
      return;
    }

    const locationId = state.currentLocationId;
    confirmDelete({
      titleKey: 'delete_location_title',
      title: copy.deleteLabel,
      messageKey: 'delete_location_message',
      message: copy.deleteMessage,
      successMessage: copy.deleted,
      failureKey: 'failed_to_delete_location',
      failureMessage: copy.failedToDelete,
      onLoadingChange: setDeleting,
      onConfirm: async () => {
        await locationServiceRef.current!.deleteLocation(userId, locationId);
        entityEventEmitter.emit('location_changed', storyId, locationId);
        navigation.goBack();
      },
    });
  };

  return { deleting, handleDelete, handleSave, saving, seeAlsoManagerRef };
}
