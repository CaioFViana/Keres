import type { EntityReference, EntitySolverContext } from './contracts';
import { getEntityDomainHandler } from './entities/EntityRegistry';

/** Delegates simple identity entirely to the entity registry. */
export async function resolveSimpleEntityReference(
  context: EntitySolverContext,
  entityType: Parameters<typeof getEntityDomainHandler>[0],
  entityId: string,
): Promise<EntityReference | undefined> {
  const handler = getEntityDomainHandler(entityType);
  return handler?.resolveReference?.(context, entityId);
}
