import type {
  SyncEntityHandler,
  SyncEntityRow,
} from '../entity-sync-handlers/BaseSyncEntityHandler';
import { duplicateOf } from '../entity-sync-handlers/BaseSyncEntityHandler';

/**
 * Refuses, as a `duplicate` of it, a row that would be what a live row of another id already is.
 */
export async function refuseTwin(
  handler: SyncEntityHandler,
  storyId: string,
  row: Record<string, unknown>,
  database: Parameters<SyncEntityHandler['findLiveTwin']>[2],
): Promise<void> {
  if (handler.naturalKey.length === 0) return;
  const twin = await handler.findLiveTwin(storyId, row as SyncEntityRow, database);
  if (twin) {
    throw duplicateOf(
      twin,
      `${handler.entityName} ${String(row.id)} is what ${String(twin.id)} already is.`,
    );
  }
}
