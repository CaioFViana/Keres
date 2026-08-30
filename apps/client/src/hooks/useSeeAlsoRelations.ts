import type { SeeAlsoEntityType } from '@keres/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDrizzle } from '../db';
import type { SeeAlsoEntityRef } from '../services/storymanagement/SeeAlsoRelationService';
import { createSeeAlsoRelationService } from '../services/storymanagement/SeeAlsoRelationService';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { entityEventEmitter } from '../utils/EventEmitter';
import { useEntityInitialLoad } from './useEntityRefreshLifecycle';

export interface SeeAlsoLink {
  relationId: string;
  otherType: SeeAlsoEntityType;
  otherId: string;
}

/**
 * A specific entity's "See also" links - it fetches, listens to `see_also_relation_changed`
 * (emitted for both sides of every link, see SeeAlsoRelationService) and exposes
 * save/remove. The same pattern as `useEntityRelations`, but scoped to a single entityId.
 */
export function useSeeAlsoRelations(
  storyId: string | undefined,
  entityType: SeeAlsoEntityType,
  entityId: string | undefined,
) {
  const drizzleDb = useDrizzle();
  const { userId } = useUserSettingsStore();

  const service = useMemo(
    () => (drizzleDb ? createSeeAlsoRelationService(drizzleDb) : null),
    [drizzleDb],
  );

  const [relations, setRelations] = useState<SeeAlsoLink[]>([]);
  const [loading, setLoading] = useState(true);
  // While `entityId` is undefined (creating), there is no real entity to write the link to -
  // it holds the chosen target here until `persistSeeAlsoRelations` is called with the real
  // id after the save. `null` = never touched (unlike `[]`, which is "deselected everything").
  const [pendingTargets, setPendingTargets] = useState<SeeAlsoEntityRef[] | null>(null);

  const refresh = useCallback(async () => {
    if (!service || !storyId || !entityId) {
      setRelations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await service.getRelationsForEntity(storyId, entityType, entityId);
      setRelations(
        rows.map((row) => {
          const isA = row.entityAType === entityType && row.entityAId === entityId;
          return {
            relationId: row.id,
            otherType: (isA ? row.entityBType : row.entityAType) as SeeAlsoEntityType,
            otherId: isA ? row.entityBId : row.entityAId,
          };
        }),
      );
    } catch (error) {
      console.error(`Failed to load See Also relations for ${entityType} ${entityId}:`, error);
      setRelations([]);
    } finally {
      setLoading(false);
    }
  }, [service, storyId, entityType, entityId]);

  useEntityInitialLoad(refresh);

  useEffect(() => {
    const handleChange = (changedStoryId: string, changedEntityId?: string) => {
      if (changedStoryId === storyId && (!changedEntityId || changedEntityId === entityId)) {
        refresh();
      }
    };
    entityEventEmitter.on('see_also_relation_changed', handleChange);
    return () => {
      entityEventEmitter.off('see_also_relation_changed', handleChange);
    };
  }, [refresh, storyId, entityId]);

  const save = useCallback(
    async (targets: SeeAlsoEntityRef[]) => {
      if (!entityId) {
        setPendingTargets(targets);
        return;
      }
      if (!service || !storyId || !userId) return;
      await service.setSeeAlsoTargets(userId, storyId, entityType, entityId, targets);
    },
    [service, storyId, userId, entityType, entityId],
  );

  const remove = useCallback(
    async (relationId: string) => {
      if (!entityId) {
        setPendingTargets((prev) =>
          (prev ?? []).filter(
            (target) => `pending:${target.entityType}:${target.entityId}` !== relationId,
          ),
        );
        return;
      }
      if (!service || !userId) return;
      await service.removeSeeAlsoLink(userId, relationId);
    },
    [service, userId, entityId],
  );

  /**
   * Actually writes the set of targets chosen while the entity did not exist yet.
   * The same pattern as `persistTagRelations`/`persistNoteRelations`: called by the form right
   * after the main save, with the id that only exists from then on.
   */
  const persistSeeAlsoRelations = useCallback(
    async (targetEntityId: string) => {
      if (!service || !storyId || !userId || pendingTargets === null) return;
      await service.setSeeAlsoTargets(userId, storyId, entityType, targetEntityId, pendingTargets);
      setPendingTargets(null);
    },
    [service, storyId, userId, entityType, pendingTargets],
  );

  const displayedRelations = useMemo<SeeAlsoLink[]>(() => {
    if (entityId || pendingTargets === null) return relations;
    return pendingTargets.map((target) => ({
      relationId: `pending:${target.entityType}:${target.entityId}`,
      otherType: target.entityType,
      otherId: target.entityId,
    }));
  }, [entityId, pendingTargets, relations]);

  return {
    relations: displayedRelations,
    loading,
    save,
    remove,
    refresh,
    persistSeeAlsoRelations,
  };
}
