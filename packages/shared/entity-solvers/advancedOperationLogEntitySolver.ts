import type { OperationLogEntityType } from '../metadata/OperationLogEntityType';
import type { EntitySolverContext } from './contracts';
import { getEntityDomainHandler } from './entities/EntityRegistry';

/**
 * Compatibility entry point for hosts that still call the former advanced solver. Rich labels now
 * belong to the entity handler itself, alongside its concise reference and metadata.
 */
export function resolveAdvancedOperationLogEntityName(
  context: EntitySolverContext,
  entityType: OperationLogEntityType,
  entityId: string,
): Promise<string | undefined> {
  return (
    getEntityDomainHandler(entityType)?.resolveOperationLogName?.(context, entityId) ??
    Promise.resolve(undefined)
  );
}
