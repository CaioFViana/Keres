import type { OperationLogEntityType } from '@keres/shared';
import { resolveBasicOperationLogEntityName } from '@keres/shared';
import type { TFunction } from 'i18next';
import type { AppDrizzleClient } from '../db';
import { resolveAdvancedEntityName } from './EntityAdvancedNameResolver';
import { getEntityIdentifier } from './EntityIdentifierResolver';
import { createClientEntitySolverContext } from './entity-solvers/ClientEntitySolverContext';

/** SQLite facade for the shared entity-presentation registry. */
export class EntityService {
  static async getEntityName(
    db: AppDrizzleClient,
    entityType: OperationLogEntityType,
    entityId: string,
    storyId: string,
    t: TFunction,
  ): Promise<string | undefined> {
    const context = createClientEntitySolverContext(db, storyId, t);
    return (
      (await resolveBasicOperationLogEntityName(context, entityType, entityId)) ??
      resolveAdvancedEntityName(db, entityType, entityId, storyId, t)
    );
  }

  static getEntityIdentifier(
    db: AppDrizzleClient,
    entityTypeString: string,
    entityId: string,
    storyId: string,
    t: TFunction,
  ): Promise<string | undefined> {
    return getEntityIdentifier(db, entityTypeString, entityId, storyId, t);
  }
}
