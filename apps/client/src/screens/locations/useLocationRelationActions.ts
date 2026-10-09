import type { TFunction } from 'i18next';
import { useCallback, type MutableRefObject } from 'react';
import type { LocationRelationService } from '../../services/storymanagement/LocationRelationService';
import { AppAlert } from '../../utils/AppAlert';

interface LocationRelationActionsParams {
  relationServiceRef: MutableRefObject<LocationRelationService | null>;
  storyId: string | undefined;
  userId: string | null | undefined;
  locationId: string;
  t: TFunction;
}

/**
 * What the location's relation manager can do: set its parent, add a child, connect it to another
 * location, remove a relation. Each says so in an alert when the service refuses (a cycle, say).
 */
export function useLocationRelationActions({
  relationServiceRef,
  storyId,
  userId,
  locationId,
  t,
}: LocationRelationActionsParams) {
  const handleSetParent = useCallback(
    async (newParentId: string | null) => {
      if (!relationServiceRef.current || !storyId || !userId) return;
      try {
        await relationServiceRef.current.setParent(userId, storyId, locationId, newParentId);
      } catch (err) {
        AppAlert.alert(
          t('error'),
          err instanceof Error ? err.message : t('failed_to_save_relation'),
        );
      }
    },
    [relationServiceRef, storyId, userId, locationId, t],
  );

  const handleAddChild = useCallback(
    async (childId: string) => {
      if (!relationServiceRef.current || !storyId || !userId) return;
      try {
        await relationServiceRef.current.setParent(userId, storyId, childId, locationId);
      } catch (err) {
        AppAlert.alert(
          t('error'),
          err instanceof Error ? err.message : t('failed_to_save_relation'),
        );
      }
    },
    [relationServiceRef, storyId, userId, locationId, t],
  );

  const handleAddConnection = useCallback(
    async (otherLocationId: string) => {
      if (!relationServiceRef.current || !storyId || !userId) return;
      try {
        await relationServiceRef.current.addConnection(
          userId,
          storyId,
          locationId,
          otherLocationId,
        );
      } catch (err) {
        AppAlert.alert(
          t('error'),
          err instanceof Error ? err.message : t('failed_to_save_relation'),
        );
      }
    },
    [relationServiceRef, storyId, userId, locationId, t],
  );

  const handleRemoveLocationRelation = useCallback(
    async (relationId: string) => {
      if (!relationServiceRef.current || !userId) return;
      try {
        await relationServiceRef.current.removeRelation(userId, relationId);
      } catch (err) {
        AppAlert.alert(
          t('error'),
          err instanceof Error ? err.message : t('failed_to_remove_relation'),
        );
      }
    },
    [relationServiceRef, userId, t],
  );

  return { handleSetParent, handleAddChild, handleAddConnection, handleRemoveLocationRelation };
}
