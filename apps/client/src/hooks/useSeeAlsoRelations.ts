import type { SeeAlsoEntityType } from '@keres/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  allowedEntityTypes?: readonly SeeAlsoEntityType[],
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
  // Forms can save immediately after the picker is tapped. A ref records that intent
  // synchronously, so two managers on the same form cannot replay an older React state.
  const pendingTargetsRef = useRef<SeeAlsoEntityRef[] | null>(null);

  /**
   * The picker can issue a second tap before a local write emits its refresh event. Keep that
   * immediate intent locally, otherwise deselect → select looks ignored while the async relation
   * service is still reconciling (especially when a specialised manager shares the same links).
   */
  const applyLocalTargets = useCallback(
    (targets: SeeAlsoEntityRef[]) => {
      const allowed = allowedEntityTypes ? new Set(allowedEntityTypes) : null;
      setRelations((current) => {
        const preserved = allowed
          ? current.filter((relation) => !allowed.has(relation.otherType))
          : [];
        const next = targets.map((target) => {
          const existing = current.find(
            (relation) =>
              relation.otherType === target.entityType && relation.otherId === target.entityId,
          );
          return (
            existing ?? {
              relationId: `pending:${target.entityType}:${target.entityId}`,
              otherType: target.entityType,
              otherId: target.entityId,
            }
          );
        });
        return [...preserved, ...next];
      });
    },
    [allowedEntityTypes],
  );

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

  /**
   * Reconcile only the subset owned by this manager. Do not rebuild the entire relation list:
   * two managers can be open for the same entity and a full replacement lets one erase the
   * other's links when their reads overlap.
   */
  const syncAllowedTargets = useCallback(
    async (
      targetEntityId: string,
      allowed: ReadonlySet<SeeAlsoEntityType>,
      targets: SeeAlsoEntityRef[],
    ) => {
      if (!service || !storyId || !userId) return;
      const current = await service.getRelationsForEntity(storyId, entityType, targetEntityId);
      const currentAllowed = current.flatMap((relation) => {
        const isA = relation.entityAType === entityType && relation.entityAId === targetEntityId;
        const target = {
          entityType: (isA ? relation.entityBType : relation.entityAType) as SeeAlsoEntityType,
          entityId: isA ? relation.entityBId : relation.entityAId,
        };
        return allowed.has(target.entityType) ? [{ relation, target }] : [];
      });
      const desired = new Map(
        targets.map((target) => [`${target.entityType}:${target.entityId}`, target]),
      );
      const existing = new Set(
        currentAllowed.map(({ target }) => `${target.entityType}:${target.entityId}`),
      );

      for (const target of desired.values()) {
        if (!existing.has(`${target.entityType}:${target.entityId}`)) {
          await service.addSeeAlsoLink(
            userId,
            storyId,
            { entityType, entityId: targetEntityId },
            target,
          );
        }
      }
      for (const { relation, target } of currentAllowed) {
        if (!desired.has(`${target.entityType}:${target.entityId}`)) {
          await service.removeSeeAlsoLink(userId, relation.id);
        }
      }
    },
    [service, storyId, userId, entityType],
  );

  const save = useCallback(
    async (targets: SeeAlsoEntityRef[]) => {
      const allowed = allowedEntityTypes ? new Set(allowedEntityTypes) : null;
      const allowedTargets = allowed
        ? targets.filter((target) => allowed.has(target.entityType))
        : targets;
      if (!entityId) {
        pendingTargetsRef.current = allowedTargets;
        setPendingTargets(allowedTargets);
        return;
      }
      if (!service || !storyId || !userId) return;
      applyLocalTargets(allowedTargets);
      if (!allowed) {
        await service.setSeeAlsoTargets(userId, storyId, entityType, entityId, allowedTargets);
        return;
      }
      await syncAllowedTargets(entityId, allowed, allowedTargets);
    },
    [
      service,
      storyId,
      userId,
      entityType,
      entityId,
      allowedEntityTypes,
      applyLocalTargets,
      syncAllowedTargets,
    ],
  );

  const remove = useCallback(
    async (relationId: string) => {
      if (!entityId) {
        const next = (pendingTargetsRef.current ?? []).filter(
          (target) => `pending:${target.entityType}:${target.entityId}` !== relationId,
        );
        pendingTargetsRef.current = next;
        setPendingTargets(next);
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
      const pending = pendingTargetsRef.current;
      if (!service || !storyId || !userId || pending === null) return;
      if (!allowedEntityTypes) {
        await service.setSeeAlsoTargets(userId, storyId, entityType, targetEntityId, pending);
      } else {
        const allowed = new Set(allowedEntityTypes);
        await syncAllowedTargets(targetEntityId, allowed, pending);
      }
      pendingTargetsRef.current = null;
      setPendingTargets(null);
    },
    [service, storyId, userId, entityType, allowedEntityTypes, syncAllowedTargets],
  );

  const displayedRelations = useMemo<SeeAlsoLink[]>(() => {
    if (entityId || pendingTargets === null) {
      return allowedEntityTypes
        ? relations.filter((relation) => allowedEntityTypes.includes(relation.otherType))
        : relations;
    }
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
