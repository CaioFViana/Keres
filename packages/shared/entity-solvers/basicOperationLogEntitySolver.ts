import { OperationLogEntityType } from '../metadata/OperationLogEntityType';
import type { EntitySolverContext } from './contracts';
import { getEntityDomainHandler } from './entities/EntityRegistry';

/**
 * Compatibility entry point for operation-log labels. Every entity now owns its own wording in the
 * registry, whether it is a direct display column or a composition of related rows.
 */
export async function resolveBasicOperationLogEntityName(
  context: EntitySolverContext,
  entityType: OperationLogEntityType,
  entityId: string,
): Promise<string | undefined> {
  return getEntityDomainHandler(entityType)?.resolveOperationLogName?.(context, entityId);
}
