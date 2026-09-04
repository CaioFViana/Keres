import { getEntityDomainHandler } from '../entity-solvers/entities/EntityRegistry';
import { suggestionDisplayValue } from '../entity-solvers/entities/displayName';
import { OperationLogEntityType } from './OperationLogEntityType';

export { suggestionDisplayValue };

/**
 * Best-effort display name from the entity's own row (no joins).
 * Does **not** prefer Character.title over Character.name — that mismatch with the client
 * was the old recovery bug.
 */
export function getSimpleDisplayName(
  entityType: string,
  row: Record<string, unknown>,
): string | null {
  if (!Object.values(OperationLogEntityType).includes(entityType as OperationLogEntityType)) {
    return null;
  }
  return (
    getEntityDomainHandler(entityType as OperationLogEntityType)?.displayName?.getName(row) ?? null
  );
}
