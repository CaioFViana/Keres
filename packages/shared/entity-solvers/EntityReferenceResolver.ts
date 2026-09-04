import { OperationLogEntityType } from '../metadata/OperationLogEntityType';
import type { EntityReference, EntitySolverContext } from './contracts';
import { resolveRelationEntityReference } from './relationEntitySolvers';
import { resolveSimpleEntityReference } from './simpleEntitySolvers';

/**
 * Resolves the concise identity used by relation labels and ID-valued fields. Operation-log display
 * names are deliberately a later purpose: they retain their existing, richer wording while their
 * entity-specific logic is migrated one solver at a time.
 */
export async function resolveEntityReference(
  context: EntitySolverContext,
  entityType: OperationLogEntityType,
  entityId: string,
): Promise<EntityReference> {
  const simple = await resolveSimpleEntityReference(context, entityType, entityId);
  if (simple) return simple;

  const relation = await resolveRelationEntityReference(
    context,
    entityType,
    entityId,
    resolveEntityReference,
  );
  if (relation) return relation;

  return { name: undefined, type: context.translate('unknown_entity_type') };
}
