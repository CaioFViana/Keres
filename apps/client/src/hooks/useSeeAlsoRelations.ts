import { SeeAlsoEntityType } from '@keres/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDrizzle } from '../db';
import { createSeeAlsoRelationService, SeeAlsoEntityRef } from '../services/storymanagement/SeeAlsoRelationService';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { entityEventEmitter } from '../utils/EventEmitter';

export interface SeeAlsoLink {
  relationId: string;
  otherType: SeeAlsoEntityType;
  otherId: string;
}

/**
 * Vínculos "Veja também" de uma entidade específica - busca, escuta `see_also_relation_changed`
 * (emitido para ambos os lados de cada vínculo, ver SeeAlsoRelationService) e expõe
 * save/remove. Mesmo padrão de `useEntityRelations`, mas escopado a um único entityId.
 */
export function useSeeAlsoRelations(storyId: string | undefined, entityType: SeeAlsoEntityType, entityId: string | undefined) {
  const drizzleDb = useDrizzle();
  const { userId } = useUserSettingsStore();

  const service = useMemo(() => (drizzleDb ? createSeeAlsoRelationService(drizzleDb) : null), [drizzleDb]);

  const [relations, setRelations] = useState<SeeAlsoLink[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!service || !storyId || !entityId) {
      setRelations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await service.getRelationsForEntity(storyId, entityType, entityId);
      setRelations(rows.map((row) => {
        const isA = row.entityAType === entityType && row.entityAId === entityId;
        return {
          relationId: row.id,
          otherType: (isA ? row.entityBType : row.entityAType) as SeeAlsoEntityType,
          otherId: isA ? row.entityBId : row.entityAId,
        };
      }));
    } catch (error) {
      console.error(`Failed to load See Also relations for ${entityType} ${entityId}:`, error);
      setRelations([]);
    } finally {
      setLoading(false);
    }
  }, [service, storyId, entityType, entityId]);

  useEffect(() => {
    refresh();
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

  const save = useCallback(async (targets: SeeAlsoEntityRef[]) => {
    if (!service || !storyId || !userId || !entityId) return;
    await service.setSeeAlsoTargets(userId, storyId, entityType, entityId, targets);
  }, [service, storyId, userId, entityType, entityId]);

  const remove = useCallback(async (relationId: string) => {
    if (!service || !userId) return;
    await service.removeSeeAlsoLink(userId, relationId);
  }, [service, userId]);

  return { relations, loading, save, remove, refresh };
}
