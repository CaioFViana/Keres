import type { EntitySolverContext } from './contracts';
import { getEntityDomainHandler } from './entities/entityHandlerLookup';
import type { OperationLogEntityType } from '../metadata/OperationLogEntityType';

/**
 * Resolves the compact, untranslated label declared by an entity handler. A plain entity falls
 * back to its handler's display field, while relation-like entities own their reference-aware
 * composition. Persistence hosts provide only the cached reader.
 *
 * Looks up handlers via `entityHandlerLookup` (not `EntityRegistry`) so relation handlers can
 * import this module without a Metro require cycle through the registry.
 */
export async function resolveCompactEntityName(
  context: EntitySolverContext,
  entityType: OperationLogEntityType,
  entityId: string,
): Promise<string | undefined> {
  const handler = getEntityDomainHandler(entityType);
  if (handler?.resolveCompactName) {
    return handler.resolveCompactName(context, entityId);
  }
  const row = await context.read(entityType, entityId);
  return handler?.displayName?.getName(row ?? {}) ?? undefined;
}

/** Uses a shortened identifier only when the referenced row has no compact display name. */
export async function resolveCompactEntityLabel(
  context: EntitySolverContext,
  entityType: OperationLogEntityType,
  entityId: string,
): Promise<string> {
  if (!entityId) return '?';
  return (await resolveCompactEntityName(context, entityType, entityId)) ?? entityId.slice(0, 8);
}
