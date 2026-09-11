import type { OperationLogEntityType } from '../metadata/OperationLogEntityType';
import type { EntityReference, EntitySolverContext } from './contracts';
import { resolveSimpleEntityReference } from './simpleEntitySolvers';

/**
 * Resolves the concise identity used by relation labels and ID-valued fields. Each entity owns its
 * presentation in the registry, including identities composed from other entity references.
 */
export async function resolveEntityReference(
  context: EntitySolverContext,
  entityType: OperationLogEntityType,
  entityId: string,
): Promise<EntityReference> {
  const simple = await resolveSimpleEntityReference(context, entityType, entityId);
  if (simple) return simple;

  return { name: undefined, type: context.translate('unknown_entity_type') };
}
