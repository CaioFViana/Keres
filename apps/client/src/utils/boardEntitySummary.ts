import type { BoardEntitySummary, BoardPinEntity } from '@keres/shared';
import type { AppDrizzleClient } from '../db';
import { createEntityPreviewService } from '../services/EntityPreviewService';

/**
 * Compatibility facade for board and map screens. The service owns database access; entity
 * handlers own the per-kind title and descriptive field.
 */
export async function loadBoardEntitySummary(
  db: AppDrizzleClient,
  entityType: BoardPinEntity,
  entityId: string,
): Promise<BoardEntitySummary | null> {
  return createEntityPreviewService(db).getBoardSummary(entityType, entityId);
}

export type { BoardEntitySummary };
