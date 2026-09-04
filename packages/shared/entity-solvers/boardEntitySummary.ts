import { OperationLogEntityType } from '../metadata/OperationLogEntityType';
import type { BoardPinEntity } from '../schemas/BoardSchemas';
import type { EntitySolverRow } from './contracts';
import { getEntityDomainHandler } from './entities/EntityRegistry';
import type { EntityPreview } from './entities/contracts';

/** Board's existing public view of an entity preview. */
export interface BoardEntitySummary {
  title: string;
  details: string | null;
}

export function summarizeEntityPreview(
  entityType: OperationLogEntityType,
  row: EntitySolverRow,
): EntityPreview | undefined {
  return getEntityDomainHandler(entityType)?.summarizePreview?.(row);
}

/** Compatibility facade for the Board-only shape. */
export function summarizeBoardEntity(
  entityType: BoardPinEntity,
  row: EntitySolverRow,
): BoardEntitySummary {
  const preview = summarizeEntityPreview(entityType as OperationLogEntityType, row);
  return {
    title: preview?.title ?? '',
    details: preview?.primaryDetail ?? preview?.secondaryDetail ?? null,
  };
}
