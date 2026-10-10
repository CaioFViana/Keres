import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppDrizzleClient } from '../../db';
import type { LocationRelationSelect, LocationSelect } from '../../db/schema';
import { createLocationRelationService } from '../../services/storymanagement/LocationRelationService';
import { AppAlert } from '../../utils/AppAlert';
import { computeAncestorIds, computeDescendantIds } from '../../utils/locationMapRelations';

export type LocationRelationEditKind = 'parent' | 'child' | 'connection';

interface Picking {
  kind: LocationRelationEditKind;
  /** The place whose relations are being edited: the node in focus. */
  locationId: string;
}

interface LocationRelationEditorInput {
  db: AppDrizzleClient;
  storyId?: string;
  userId?: string | null;
  locations: readonly LocationSelect[];
  /** The live relations of the story (deleted ones already left out). */
  relations: readonly LocationRelationSelect[];
  /** Loads the map again once something was written. */
  reload: () => Promise<void>;
}

const PICKER_TITLE: Record<LocationRelationEditKind, string> = {
  parent: 'select_parent_location',
  child: 'select_child_location',
  connection: 'select_location_to_connect',
};

/**
 * Setting where a place is, what it holds and what it is connected to, from the structure map. The
 * candidates and the cycle rules are those of the location's own page (a place cannot be put inside
 * itself or inside what it holds), and everything goes through the same relation service. The map
 * shows the result straight away because it loads again afterwards.
 */
export function useLocationRelationEditor({
  db,
  storyId,
  userId,
  locations,
  relations,
  reload,
}: LocationRelationEditorInput) {
  const { t } = useTranslation();
  const [picking, setPicking] = useState<Picking | null>(null);

  const candidates = useMemo((): LocationSelect[] => {
    if (!picking) return [];
    const { kind, locationId } = picking;
    const mutable = [...relations];
    if (kind === 'parent') {
      const descendants = computeDescendantIds(mutable, locationId);
      const currentParent = relations.find(
        (relation) => relation.relationType === 'contains' && relation.locationBId === locationId,
      )?.locationAId;
      return locations.filter(
        (place) =>
          place.id !== locationId && !descendants.has(place.id) && place.id !== currentParent,
      );
    }
    if (kind === 'child') {
      const ancestors = computeAncestorIds(mutable, locationId);
      const children = new Set(
        relations
          .filter((r) => r.relationType === 'contains' && r.locationAId === locationId)
          .map((r) => r.locationBId),
      );
      return locations.filter(
        (place) => place.id !== locationId && !ancestors.has(place.id) && !children.has(place.id),
      );
    }
    const connected = new Set(
      relations
        .filter(
          (r) =>
            r.relationType === 'connected_to' &&
            (r.locationAId === locationId || r.locationBId === locationId),
        )
        .map((r) => (r.locationAId === locationId ? r.locationBId : r.locationAId)),
    );
    connected.add(locationId);
    return locations.filter((place) => !connected.has(place.id));
  }, [locations, picking, relations]);

  const open = useCallback(
    (kind: LocationRelationEditKind, locationId: string) => setPicking({ kind, locationId }),
    [],
  );
  const close = useCallback(() => setPicking(null), []);

  /** Runs a write, then loads the map again; a failure tells the author and leaves the map as it was. */
  const write = useCallback(
    async (action: (userId: string, storyId: string) => Promise<unknown>) => {
      if (!storyId || !userId) {
        AppAlert.alert(t('error'), t('service_not_initialized'));
        return;
      }
      try {
        await action(userId, storyId);
        await reload();
      } catch (error) {
        console.error('Failed to change a location relation:', error);
        AppAlert.alert(t('error'), t('failed_to_save_relation'));
      }
    },
    [reload, storyId, t, userId],
  );

  const pick = useCallback(
    async (otherId: string) => {
      if (!picking) return;
      const { kind, locationId } = picking;
      setPicking(null);
      const service = createLocationRelationService(db);
      await write((user, story) => {
        if (kind === 'parent') return service.setParent(user, story, locationId, otherId);
        if (kind === 'child') return service.setParent(user, story, otherId, locationId);
        return service.addConnection(user, story, locationId, otherId);
      });
    },
    [db, picking, write],
  );

  /** Asks before taking a relation away: it never deletes the places, only the link between them. */
  const confirmRemoval = useCallback(
    (
      titleKey: string,
      messageKey: string,
      remove: (userId: string, storyId: string) => Promise<unknown>,
    ) => {
      AppAlert.alert(t(titleKey), t(messageKey), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('remove'), style: 'destructive', onPress: () => void write(remove) },
      ]);
    },
    [t, write],
  );

  const removeParent = useCallback(
    (locationId: string) =>
      confirmRemoval(
        'remove_parent_location_title',
        'remove_parent_location_message',
        (user, story) => createLocationRelationService(db).setParent(user, story, locationId, null),
      ),
    [confirmRemoval, db],
  );
  const removeChild = useCallback(
    (childId: string) =>
      confirmRemoval(
        'remove_child_location_title',
        'remove_child_location_message',
        (user, story) => createLocationRelationService(db).setParent(user, story, childId, null),
      ),
    [confirmRemoval, db],
  );
  const removeConnection = useCallback(
    (relationId: string) =>
      confirmRemoval('remove_connection_title', 'remove_connection_message', (user) =>
        createLocationRelationService(db).removeRelation(user, relationId),
      ),
    [confirmRemoval, db],
  );

  return {
    picking,
    pickerTitle: picking ? t(PICKER_TITLE[picking.kind]) : '',
    candidates,
    open,
    close,
    pick,
    removeParent,
    removeChild,
    removeConnection,
  };
}
