import { OperationLogEntityType } from '../metadata/OperationLogEntityType';
import type { EntitySolverContext } from './contracts';
import { resolveEntityReference } from './EntityReferenceResolver';

const BASIC_OPERATION_LOG_ENTITY_TYPES = new Set<OperationLogEntityType>([
  OperationLogEntityType.Board,
  OperationLogEntityType.LocationMap,
  OperationLogEntityType.Story,
  OperationLogEntityType.StoryArc,
  OperationLogEntityType.Character,
  OperationLogEntityType.Note,
  OperationLogEntityType.Location,
  OperationLogEntityType.WorldRule,
  OperationLogEntityType.Tag,
  OperationLogEntityType.Chapter,
  OperationLogEntityType.Scene,
  OperationLogEntityType.Gallery,
  OperationLogEntityType.Item,
  OperationLogEntityType.Plot,
  OperationLogEntityType.Route,
]);

/**
 * Operation-log labels for entities whose identity is already solved by the reference factory.
 * Complex rows have dedicated solvers, rather than making this common path depend on host details.
 */
export async function resolveBasicOperationLogEntityName(
  context: EntitySolverContext,
  entityType: OperationLogEntityType,
  entityId: string,
): Promise<string | undefined> {
  if (!BASIC_OPERATION_LOG_ENTITY_TYPES.has(entityType)) return undefined;
  const reference = await resolveEntityReference(context, entityType, entityId);
  return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
}
