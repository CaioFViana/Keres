import type { SeeAlsoManagerHandle } from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import { useEntityFormActions } from '@/src/hooks/useEntityFormActions';
import type { Location } from '@keres/shared/entities/Location';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StackActions } from '@react-navigation/native';
import type { StorySchemaField } from '@keres/shared';
import type { RefObject } from 'react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppDrizzleClient } from '../../db';
import type { LocationStackParamList } from '../../navigation/MainSystemStack';
import type { LocationService } from '../../services/storymanagement/LocationService';
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

type LocationData = Omit<
  Location,
  'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
>;

/** What differs for the Location form: its fields, service calls, secondary writes, texts and navigation. */
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
  const seeAlsoManagerRef = useRef<SeeAlsoManagerHandle>(null);
  const service = () => locationServiceRef.current!;

  const actions = useEntityFormActions<LocationData, { id: string }>({
    entityType: 'Location',
    changeEvent: 'location_changed',
    storyId,
    userId,
    drizzleDb,
    customFields,
    customValues: state.customValues,
    currentEntityId: state.currentLocationId,
    serviceReady: !!locationServiceRef.current,
    clearFormDraft: state.clearFormDraft,
    retainPersistedId: state.retainPersistedLocationId,
    validate: () => (state.name.trim() ? null : t('name_required')),
    buildData: () => ({
      name: state.name.trim(),
      description: state.description,
      intExt: state.intExt,
      climate: state.climate,
      culture: state.culture,
      politics: state.politics,
      isFavorite: state.isFavorite,
      extraNotes: state.extraNotes,
    }),
    create: (currentUserId, currentStoryId, data) =>
      service().createLocation(currentUserId, { ...data, storyId: currentStoryId }),
    update: (currentUserId, locationId, data) =>
      service().updateLocation(currentUserId, locationId, data),
    remove: (currentUserId, locationId) => service().deleteLocation(currentUserId, locationId),
    secondarySteps: [
      persistTagRelations,
      persistNoteRelations,
      (locationId) => seeAlsoManagerRef.current?.persistPending(locationId) ?? Promise.resolve(),
      persistPendingLocationRelations,
    ],
    persistSecondaryDraft,
    clearSecondaryDraft,
    messages: {
      failedToSave: copy.failedToSave,
      created: copy.created,
      updated: copy.updated,
    },
    confirmDelete: {
      titleKey: 'delete_location_title',
      title: copy.deleteLabel,
      messageKey: 'delete_location_message',
      message: copy.deleteMessage,
      successMessage: copy.deleted,
      failureKey: 'failed_to_delete_location',
      failureMessage: copy.failedToDelete,
    },
    afterSave: (locationId, created) => {
      if (created) {
        navigation.dispatch(StackActions.replace('LocationForm', { locationId }));
      } else {
        navigation.goBack();
      }
    },
    afterDelete: () => navigation.goBack(),
    logName: 'location',
  });

  return { ...actions, seeAlsoManagerRef };
}
