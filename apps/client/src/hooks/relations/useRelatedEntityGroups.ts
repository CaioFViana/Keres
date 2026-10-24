import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RelatedEntityItem } from '@/src/components/common/lists/RelatedEntitiesList/RelatedEntitiesList';
import { useDrizzle } from '@/src/db';
import { EntityService } from '@/src/services/entity-solvers/EntityService';
import { logger } from '@/src/utils/logging/logger';

/** Every kind a relation can point to, so each one is always present (empty until something is found). */
const RELATION_KINDS = [
  'chapter',
  'character',
  'choice',
  'item',
  'itemjourney',
  'location',
  'note',
  'operationlog',
  'scene',
  'story',
  'suggestion',
  'tag',
  'user',
  'worldrule',
  'characterrelation',
  'noterelation',
  'tagrelation',
  'characterscene',
] as const;

const emptyGroups = (): Record<string, RelatedEntityItem[]> =>
  Object.fromEntries(RELATION_KINDS.map((kind) => [kind, []]));

const NO_GROUPS = emptyGroups();

interface RelationReference {
  relationType: string;
  relationId: string;
}

/**
 * The entities a list of relations points to, named by the entity solver and grouped by kind (the
 * lowercased relation type). Naming is asynchronous, so a naming pass that finishes after the
 * relations changed - or after the screen left - is dropped, and groups from older relations are
 * never shown for newer ones. `relations` must be stable between renders unless it changed.
 */
export function useRelatedEntityGroups(
  storyId: string | undefined,
  relations: readonly RelationReference[],
) {
  const drizzleDb = useDrizzle();
  const { t } = useTranslation();
  const [named, setNamed] = useState<{
    source: readonly RelationReference[];
    groups: Record<string, RelatedEntityItem[]>;
  } | null>(null);

  useEffect(() => {
    if (!storyId) return;
    let ignore = false;
    (async () => {
      const groups = emptyGroups();
      for (const relation of relations) {
        const name = await EntityService.getEntityIdentifier(
          drizzleDb,
          relation.relationType,
          relation.relationId,
          storyId,
          t,
        );
        if (name) {
          const kind = relation.relationType.toLowerCase();
          (groups[kind] ??= []).push({ id: relation.relationId, name });
        }
      }
      if (!ignore) setNamed({ source: relations, groups });
    })().catch((error) => logger.error('Failed to name the related entities:', error));
    return () => {
      ignore = true;
    };
  }, [relations, storyId, drizzleDb, t]);

  return named?.source === relations ? named.groups : NO_GROUPS;
}
