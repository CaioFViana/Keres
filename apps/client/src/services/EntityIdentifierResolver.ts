import {
  resolveEntityIdentifierTypeAlias,
  resolveEntityReference,
  type EntityReference,
  type OperationLogEntityType,
} from '@keres/shared';
import type { TFunction } from 'i18next';
import type { AppDrizzleClient } from '../db';
import { createClientEntitySolverContext } from './entity-solvers/ClientEntitySolverContext';

/**
 * Compatibility facade for relation labels. The entity-specific behavior now lives in portable
 * solvers under `@keres/shared/entity-solvers`; this only supplies the SQLite reader and i18n port.
 */
export async function resolveRelationEntityName(
  db: AppDrizzleClient,
  relationType: OperationLogEntityType,
  relationId: string,
  storyId: string,
  t: TFunction,
): Promise<EntityReference> {
  return resolveEntityReference(
    createClientEntitySolverContext(db, storyId, t),
    relationType,
    relationId,
  );
}

export async function getEntityIdentifier(
  db: AppDrizzleClient,
  entityTypeString: string,
  entityId: string,
  storyId: string,
  t: TFunction,
): Promise<string | undefined> {
  const entityType = resolveEntityIdentifierTypeAlias(entityTypeString);
  if (!entityType) throw new Error(`Invalid entityTypeString: ${entityTypeString}`);
  return (await resolveRelationEntityName(db, entityType, entityId, storyId, t)).name;
}
