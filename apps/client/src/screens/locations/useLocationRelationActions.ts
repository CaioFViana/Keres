import type { TFunction } from 'i18next';
import { useCallback } from 'react';
import type { LocationRelationService } from '@/src/services/storymanagement/relations/LocationRelationService';
import { AppAlert } from '@/src/state/ui/AppAlert';

interface LocationRelationActionsParams {
  relationService: LocationRelationService;
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
  relationService,
  storyId,
  userId,
  locationId,
  t,
}: LocationRelationActionsParams) {
  const handleSetParent = useCallback(
    async (newParentId: string | null) => {
      if (!storyId || !userId) return;
      try {
        await relationService.setParent(userId, storyId, locationId, newParentId);
      } catch (err) {
        AppAlert.alert(
          t('error'),
          err instanceof Error ? err.message : t('failed_to_save_relation'),
        );
      }
    },
    [relationService, storyId, userId, locationId, t],
  );

  const handleAddChild = useCallback(
    async (childId: string) => {
      if (!storyId || !userId) return;
      try {
        await relationService.setParent(userId, storyId, childId, locationId);
      } catch (err) {
        AppAlert.alert(
          t('error'),
          err instanceof Error ? err.message : t('failed_to_save_relation'),
        );
      }
    },
    [relationService, storyId, userId, locationId, t],
  );

  const handleAddConnection = useCallback(
    async (otherLocationId: string) => {
      if (!storyId || !userId) return;
      try {
        await relationService.addConnection(userId, storyId, locationId, otherLocationId);
      } catch (err) {
        AppAlert.alert(
          t('error'),
          err instanceof Error ? err.message : t('failed_to_save_relation'),
        );
      }
    },
    [relationService, storyId, userId, locationId, t],
  );

  const handleRemoveLocationRelation = useCallback(
    async (relationId: string) => {
      if (!userId) return;
      try {
        await relationService.removeRelation(userId, relationId);
      } catch (err) {
        AppAlert.alert(
          t('error'),
          err instanceof Error ? err.message : t('failed_to_remove_relation'),
        );
      }
    },
    [relationService, userId, t],
  );

  return { handleSetParent, handleAddChild, handleAddConnection, handleRemoveLocationRelation };
}
