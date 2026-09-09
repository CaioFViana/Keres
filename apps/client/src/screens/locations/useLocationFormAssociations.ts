import type { RefObject } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LocationRelationSelect, LocationSelect } from '../../db/schema';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import {
  patchEntityFormSecondaryDraft,
  readEntityFormSecondaryDraft,
} from '../../services/storymanagement/EntityFormSecondaryDraftStore';
import type { LocationRelationService } from '../../services/storymanagement/LocationRelationService';
import type { LocationService } from '../../services/storymanagement/LocationService';
import { AppAlert } from '../../utils/AppAlert';
import { createULID } from '../../utils/entityUtils';

const makePendingLocationRelation = (
  storyId: string,
  relationType: 'contains' | 'connected_to',
  locationAId: string,
  locationBId: string,
): LocationRelationSelect => ({
  id: `pending-${createULID()}`,
  storyId,
  locationAId,
  locationBId,
  relationType,
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  isDeleted: false,
  deletedAt: null,
});

type UseLocationFormAssociationsOptions = {
  /** Route id when opening an existing location — used to restore durable pending relations. */
  initialLocationId?: string;
  currentLocationId: string | undefined;
  storyId?: string;
  userId?: string | null;
  locationServiceRef: RefObject<LocationService | null>;
  locationRelationServiceRef: RefObject<LocationRelationService | null>;
  onSecondaryDraftRestored?: () => void;
};

/** Owns relation, pending-relation and entity-relation wiring used by the Location form. */
export function useLocationFormAssociations({
  initialLocationId,
  currentLocationId,
  storyId,
  userId,
  locationServiceRef,
  locationRelationServiceRef,
  onSecondaryDraftRestored,
}: UseLocationFormAssociationsOptions) {
  const { t } = useTranslation();
  const [allLocations, setAllLocations] = useState<LocationSelect[]>([]);
  const [allLocationRelations, setAllLocationRelations] = useState<LocationRelationSelect[]>([]);
  // While the location does not exist yet, each operation becomes a synthetic relation here instead of
  // writing to the database - '' in place of the not-yet-created side. Replayed in
  // `persistPendingLocationRelations` after the main save.
  const [pendingLocationRelations, setPendingLocationRelations] = useState<
    LocationRelationSelect[]
  >([]);

  const relations = useEntityRelations({
    entityType: 'Location',
    entityId: currentLocationId,
    preserveDraftOnEntityCreation: true,
  });

  const fetchAllLocationsInStory = useCallback(async () => {
    if (!locationServiceRef.current || !storyId) {
      setAllLocations([]);
      return;
    }
    try {
      const fetchedLocations = await locationServiceRef.current.getAllByStoryId(storyId);
      setAllLocations(fetchedLocations.filter((l) => !l.isDeleted));
    } catch (err) {
      console.error('Failed to fetch all locations:', err);
    }
  }, [locationServiceRef, storyId]);

  const fetchAllLocationRelationsInStory = useCallback(async () => {
    if (!locationRelationServiceRef.current || !storyId) {
      setAllLocationRelations([]);
      return;
    }
    try {
      const fetchedRelations =
        await locationRelationServiceRef.current.getAllRelationsForStory(storyId);
      setAllLocationRelations(fetchedRelations);
    } catch (err) {
      console.error('Failed to fetch all location relations:', err);
    }
  }, [locationRelationServiceRef, storyId]);

  useEffect(() => {
    void fetchAllLocationsInStory();
    void fetchAllLocationRelationsInStory();
  }, [fetchAllLocationsInStory, fetchAllLocationRelationsInStory]);

  useEffect(() => {
    if (!storyId || !initialLocationId) return;
    let cancelled = false;
    void (async () => {
      const draft = await readEntityFormSecondaryDraft(storyId, 'Location', initialLocationId);
      if (cancelled || !draft?.pendingEntityRelations?.length) return;
      setPendingLocationRelations(draft.pendingEntityRelations as LocationRelationSelect[]);
      onSecondaryDraftRestored?.();
    })();
    return () => {
      cancelled = true;
    };
  }, [storyId, initialLocationId, onSecondaryDraftRestored]);

  const handleTagSelectionChange = useCallback(
    (newSelection: string[]) => {
      relations.setSelectedTagIds(newSelection);
    },
    [relations],
  );

  const syncPendingLocationRelationsToDraft = useCallback(
    async (nextPending: LocationRelationSelect[]) => {
      if (!storyId || !currentLocationId) return;
      try {
        await patchEntityFormSecondaryDraft(storyId, 'Location', currentLocationId, {
          pendingEntityRelations: nextPending,
        });
      } catch (error) {
        console.error('Failed to sync pending location relations to secondary draft:', error);
      }
    },
    [storyId, currentLocationId],
  );

  const handleSetParent = useCallback(
    async (newParentId: string | null) => {
      if (!currentLocationId) {
        setPendingLocationRelations((prev) => {
          const withoutParent = prev.filter(
            (r) => !(r.relationType === 'contains' && r.locationBId === ''),
          );
          return newParentId === null
            ? withoutParent
            : [
                ...withoutParent,
                makePendingLocationRelation(storyId ?? '', 'contains', newParentId, ''),
              ];
        });
        return;
      }
      if (!locationRelationServiceRef.current || !storyId || !userId) return;
      try {
        await locationRelationServiceRef.current.setParent(
          userId,
          storyId,
          currentLocationId,
          newParentId,
        );
        void fetchAllLocationRelationsInStory();
      } catch (err) {
        AppAlert.alert(
          t('error'),
          err instanceof Error ? err.message : t('failed_to_save_relation'),
        );
      }
    },
    [
      storyId,
      userId,
      currentLocationId,
      t,
      fetchAllLocationRelationsInStory,
      locationRelationServiceRef,
    ],
  );

  const handleAddChild = useCallback(
    async (childId: string) => {
      if (!currentLocationId) {
        setPendingLocationRelations((prev) => [
          ...prev,
          makePendingLocationRelation(storyId ?? '', 'contains', '', childId),
        ]);
        return;
      }
      if (!locationRelationServiceRef.current || !storyId || !userId) return;
      try {
        await locationRelationServiceRef.current.setParent(
          userId,
          storyId,
          childId,
          currentLocationId,
        );
        void fetchAllLocationRelationsInStory();
      } catch (err) {
        AppAlert.alert(
          t('error'),
          err instanceof Error ? err.message : t('failed_to_save_relation'),
        );
      }
    },
    [
      storyId,
      userId,
      currentLocationId,
      t,
      fetchAllLocationRelationsInStory,
      locationRelationServiceRef,
    ],
  );

  const handleAddConnection = useCallback(
    async (otherLocationId: string) => {
      if (!currentLocationId) {
        setPendingLocationRelations((prev) => [
          ...prev,
          makePendingLocationRelation(storyId ?? '', 'connected_to', '', otherLocationId),
        ]);
        return;
      }
      if (!locationRelationServiceRef.current || !storyId || !userId) return;
      try {
        await locationRelationServiceRef.current.addConnection(
          userId,
          storyId,
          currentLocationId,
          otherLocationId,
        );
        void fetchAllLocationRelationsInStory();
      } catch (err) {
        AppAlert.alert(
          t('error'),
          err instanceof Error ? err.message : t('failed_to_save_relation'),
        );
      }
    },
    [
      storyId,
      userId,
      currentLocationId,
      t,
      fetchAllLocationRelationsInStory,
      locationRelationServiceRef,
    ],
  );

  const handleRemoveLocationRelation = useCallback(
    async (relationId: string) => {
      if (
        !currentLocationId ||
        pendingLocationRelations.some((relation) => relation.id === relationId)
      ) {
        const nextPending = pendingLocationRelations.filter((r) => r.id !== relationId);
        setPendingLocationRelations(nextPending);
        await syncPendingLocationRelationsToDraft(nextPending);
        return;
      }
      if (!locationRelationServiceRef.current || !userId) return;
      try {
        await locationRelationServiceRef.current.removeRelation(userId, relationId);
        void fetchAllLocationRelationsInStory();
      } catch (err) {
        AppAlert.alert(
          t('error'),
          err instanceof Error ? err.message : t('failed_to_remove_relation'),
        );
      }
    },
    [
      userId,
      t,
      fetchAllLocationRelationsInStory,
      currentLocationId,
      locationRelationServiceRef,
      pendingLocationRelations,
      syncPendingLocationRelationsToDraft,
    ],
  );

  /**
   * Saves relations accumulated while the location did not exist yet - '' in place of the
   * not-yet-created side; swaps in the real id here.
   */
  const persistPendingLocationRelations = async (targetLocationId: string) => {
    if (!locationRelationServiceRef.current || !storyId || !userId) return;
    for (const pending of pendingLocationRelations) {
      if (pending.relationType === 'contains') {
        if (pending.locationAId === '') {
          await locationRelationServiceRef.current.setParent(
            userId,
            storyId,
            pending.locationBId,
            targetLocationId,
          );
        } else {
          await locationRelationServiceRef.current.setParent(
            userId,
            storyId,
            targetLocationId,
            pending.locationAId,
          );
        }
      } else {
        const otherId = pending.locationAId === '' ? pending.locationBId : pending.locationAId;
        await locationRelationServiceRef.current.addConnection(
          userId,
          storyId,
          targetLocationId,
          otherId,
        );
      }
      setPendingLocationRelations((current) =>
        current.filter((relation) => relation.id !== pending.id),
      );
    }
    if (pendingLocationRelations.length > 0) {
      void fetchAllLocationRelationsInStory();
    }
  };

  return {
    ...relations,
    locationNoteRelations: relations.noteRelations,
    handleTagSelectionChange,
    allLocations,
    // Persisted and pending queues stay visible together after identity retention / draft restore.
    allLocationRelations: [...allLocationRelations, ...pendingLocationRelations],
    pendingLocationRelations,
    handleSetParent,
    handleAddChild,
    handleAddConnection,
    handleRemoveLocationRelation,
    persistPendingLocationRelations,
  };
}
