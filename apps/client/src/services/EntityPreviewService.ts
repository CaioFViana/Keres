import { type BoardEntitySummary, type BoardPinEntity, summarizeBoardEntity } from '@keres/shared';
import { and, eq, type SQL } from 'drizzle-orm';
import type { AppDrizzleClient } from '../db';
import { getEntityTable } from './entityTableRegistry';

export interface EntityPreviewService {
  getBoardSummary(entityType: BoardPinEntity, entityId: string): Promise<BoardEntitySummary | null>;
}

/**
 * Persistence adapter for entity previews. Entity-specific wording stays in the shared handler;
 * this service only reads the registered local row and excludes soft-deleted records.
 */
export function createEntityPreviewService(db: AppDrizzleClient): EntityPreviewService {
  return {
    async getBoardSummary(entityType, entityId) {
      const table = getEntityTable(entityType);
      if (!table) return null;

      const conditions: SQL<boolean>[] = [eq((table as any).id, entityId) as SQL<boolean>];
      if ('isDeleted' in table) {
        conditions.push(eq((table as any).isDeleted, false) as SQL<boolean>);
      }
      const row = (await db
        .select()
        .from(table as any)
        .where(and(...conditions))
        .get()) as Record<string, unknown> | undefined;

      return row ? summarizeBoardEntity(entityType, row) : null;
    },
  };
}
