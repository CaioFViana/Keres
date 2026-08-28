import type { LocationMapContentType, LocationMapNodeType } from '@keres/shared';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { LocationMapNodeConnection } from '@/src/components/features/location-maps/LocationMapNodeSheet';
import type { AppDrizzleClient } from '../db';
import type { LocationRelationSelect, LocationSelect } from '../db/schema';
import { createLocationRelationService } from '../services/storymanagement/LocationRelationService';
import {
  computeAncestorIds,
  computeDescendantIds,
  deriveChildren,
  deriveConnections,
  deriveContains,
  deriveParent,
} from '../utils/locationMapRelations';

type Notify = (message: string, type?: 'success' | 'warning' | 'error') => void;

interface UseLocationMapRelationsOptions {
  db: AppDrizzleClient;
  storyId?: string;
  userId?: string | null;
  relations: LocationRelationSelect[];
  setRelations: (relations: LocationRelationSelect[]) => void;
  locations: LocationSelect[];
  content: LocationMapContentType;
  selectedNode: LocationMapNodeType | null;
  notify: Notify;
}

/**
 * Everything the map needs from the story's real location relations: the lines to draw over the
 * map, the parent/children/connections shown in the node sheet, the valid picker candidates
 * (excluding cycles), and the actions that create/remove the relations through the relation
 * service - the same relations the Location Relation manager owns.
 */
export function useLocationMapRelations({
  db,
  storyId,
  userId,
  relations,
  setRelations,
  locations,
  content,
  selectedNode,
  notify,
}: UseLocationMapRelationsOptions) {
  const { t } = useTranslation();
  const locationNameById = useMemo(
    () => new Map(locations.map((location) => [location.id, location.name])),
    [locations],
  );

  const reloadRelations = useCallback(async () => {
    if (!storyId) return;
    const loadedRelations = await createLocationRelationService(db).getAllRelationsForStory(storyId);
    setRelations(loadedRelations.filter((x) => !x.isDeleted));
  }, [db, setRelations, storyId]);

  const connections = useMemo(() => deriveConnections(relations, content), [relations, content]);
  const contains = useMemo(() => deriveContains(relations, content), [relations, content]);

  const nodeConnections = useMemo((): LocationMapNodeConnection[] => {
    if (!selectedNode) return [];
    return relations
      .filter(
        (relation) =>
          relation.relationType === 'connected_to' &&
          (relation.locationAId === selectedNode.locationId ||
            relation.locationBId === selectedNode.locationId),
      )
      .map((relation) => {
        const otherId =
          relation.locationAId === selectedNode.locationId
            ? relation.locationBId
            : relation.locationAId;
        return {
          relationId: relation.id,
          otherLocationId: otherId,
          otherName: locationNameById.get(otherId) ?? otherId,
        };
      });
  }, [relations, selectedNode, locationNameById]);

  const nodeParent = useMemo(
    () => (selectedNode ? deriveParent(relations, selectedNode.locationId, locationNameById) : null),
    [relations, selectedNode, locationNameById],
  );
  const nodeChildren = useMemo(
    () =>
      selectedNode ? deriveChildren(relations, selectedNode.locationId, locationNameById) : [],
    [relations, selectedNode, locationNameById],
  );
  const ancestorIds = useMemo(
    () =>
      selectedNode ? computeAncestorIds(relations, selectedNode.locationId) : new Set<string>(),
    [relations, selectedNode],
  );
  const descendantIds = useMemo(
    () =>
      selectedNode ? computeDescendantIds(relations, selectedNode.locationId) : new Set<string>(),
    [relations, selectedNode],
  );
  const parentCandidates = useMemo(() => {
    if (!selectedNode) return [];
    return locations
      .filter(
        (location) =>
          location.id !== selectedNode.locationId &&
          !descendantIds.has(location.id) &&
          location.id !== nodeParent?.locationId,
      )
      .map((location) => ({ id: location.id, name: location.name }));
  }, [descendantIds, locations, nodeParent, selectedNode]);
  const childCandidates = useMemo(() => {
    if (!selectedNode) return [];
    return locations
      .filter(
        (location) =>
          location.id !== selectedNode.locationId &&
          !ancestorIds.has(location.id) &&
          !nodeChildren.some((child) => child.locationId === location.id),
      )
      .map((location) => ({ id: location.id, name: location.name }));
  }, [ancestorIds, locations, nodeChildren, selectedNode]);
  const connectCandidates = useMemo(() => {
    if (!selectedNode) return [];
    const connectedIds = new Set(nodeConnections.map((connection) => connection.otherLocationId));
    connectedIds.add(selectedNode.locationId);
    return locations
      .filter((location) => !connectedIds.has(location.id))
      .map((location) => ({ id: location.id, name: location.name }));
  }, [locations, nodeConnections, selectedNode]);

  const fail = useCallback(
    (message: string) => {
      console.log(message);
      notify(t('failed_to_save_relation'), 'error');
    },
    [notify, t],
  );

  const handleAddConnection = useCallback(
    async (otherLocationId: string) => {
      if (!selectedNode || !storyId || !userId) return;
      try {
        await createLocationRelationService(db).addConnection(
          userId,
          storyId,
          selectedNode.locationId,
          otherLocationId,
        );
        await reloadRelations();
      } catch {
        fail('LocationMapScreen: failed to add connection.');
      }
    },
    [db, fail, reloadRelations, selectedNode, storyId, userId],
  );

  const handleRemoveConnection = useCallback(
    async (relationId: string) => {
      if (!userId) return;
      try {
        await createLocationRelationService(db).removeRelation(userId, relationId);
        await reloadRelations();
      } catch {
        fail('LocationMapScreen: failed to remove connection.');
      }
    },
    [db, fail, reloadRelations, userId],
  );

  const handleSetParent = useCallback(
    async (parentId: string) => {
      if (!selectedNode || !storyId || !userId) return;
      try {
        await createLocationRelationService(db).setParent(
          userId,
          storyId,
          selectedNode.locationId,
          parentId,
        );
        await reloadRelations();
      } catch {
        fail('LocationMapScreen: failed to set parent.');
      }
    },
    [db, fail, reloadRelations, selectedNode, storyId, userId],
  );

  const handleRemoveParent = useCallback(async () => {
    if (!selectedNode || !storyId || !userId) return;
    try {
      await createLocationRelationService(db).setParent(
        userId,
        storyId,
        selectedNode.locationId,
        null,
      );
      await reloadRelations();
    } catch {
      fail('LocationMapScreen: failed to remove parent.');
    }
  }, [db, fail, reloadRelations, selectedNode, storyId, userId]);

  const handleAddChild = useCallback(
    async (childId: string) => {
      if (!selectedNode || !storyId || !userId) return;
      try {
        await createLocationRelationService(db).setParent(
          userId,
          storyId,
          childId,
          selectedNode.locationId,
        );
        await reloadRelations();
      } catch {
        fail('LocationMapScreen: failed to add child.');
      }
    },
    [db, fail, reloadRelations, selectedNode, storyId, userId],
  );

  const handleRemoveRelation = useCallback(
    async (relationId: string) => {
      if (!userId) return;
      try {
        await createLocationRelationService(db).removeRelation(userId, relationId);
        await reloadRelations();
      } catch {
        fail('LocationMapScreen: failed to remove relation.');
      }
    },
    [db, fail, reloadRelations, userId],
  );

  return {
    connections,
    contains,
    nodeConnections,
    nodeParent,
    nodeChildren,
    parentCandidates,
    childCandidates,
    connectCandidates,
    handleAddConnection,
    handleRemoveConnection,
    handleSetParent,
    handleRemoveParent,
    handleAddChild,
    handleRemoveRelation,
  };
}