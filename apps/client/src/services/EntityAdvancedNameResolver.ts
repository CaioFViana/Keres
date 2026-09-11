import { resolveAdvancedOperationLogEntityName, type OperationLogEntityType } from '@keres/shared';
import type { TFunction } from 'i18next';
import type { AppDrizzleClient } from '../db';
import { createClientEntitySolverContext } from './entity-solvers/ClientEntitySolverContext';

/** SQLite facade for shared composite operation-log entity names. */
export function resolveAdvancedEntityName(
  db: AppDrizzleClient,
  entityType: OperationLogEntityType,
  entityId: string,
  storyId: string,
  t: TFunction,
): Promise<string | undefined> {
  return resolveAdvancedOperationLogEntityName(
    createClientEntitySolverContext(db, storyId, t),
    entityType,
    entityId,
  );
}
