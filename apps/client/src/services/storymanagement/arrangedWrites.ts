import { compareRanked, planRankChanges } from '@keres/shared';
import type { SQL } from 'drizzle-orm';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import { chapters, scenes, stats, storySchemaFields } from '../../db/schema';
import { recordLocalOperationSync } from '../../utils/syncUtils';

/**
 * Local writes of arranged rows' places (a chapter's scenes, a story's chapters, stats, schema
 * fields). A place is the row's own `rank` (see `rules/rank.ts`): moving a row is an ordinary edit
 * of that row, recorded like any other, and the database derives `index`/`order` from the ranks
 * (the rank triggers of the local schema). Nothing here writes a position or touches a container.
 *
 * Synchronous, to run inside the `runLocalWrite` unit of the write that needs the place: the rows
 * are read in the same unit that writes, so a place is never computed from a stale list.
 */

export type ArrangedEntityType = 'Scene' | 'Chapter' | 'Stat' | 'StorySchemaField';

/** The values naming a container, beyond the story: a scene's chapter, a chapter's kind... */
export type ArrangedContainer = Record<string, string | null>;

const TABLES = {
  Scene: scenes,
  Chapter: chapters,
  Stat: stats,
  StorySchemaField: storySchemaFields,
} as const;

function containerScope(
  entityType: ArrangedEntityType,
  storyId: string,
  container: ArrangedContainer,
): SQL | undefined {
  const table = TABLES[entityType] as any;
  const conditions: SQL[] = [eq(table.storyId, storyId), eq(table.isDeleted, false)];
  for (const [field, value] of Object.entries(container)) {
    conditions.push(value === null ? isNull(table[field]) : eq(table[field], value));
  }
  return and(...conditions);
}

/** The live rows of a container with their ranks. */
export function arrangedRowsSync(
  db: AppDrizzleClient,
  entityType: ArrangedEntityType,
  storyId: string,
  container: ArrangedContainer,
): { id: string; rank: string }[] {
  const table = TABLES[entityType] as any;
  return db
    .select({ id: table.id, rank: table.rank })
    .from(table)
    .where(containerScope(entityType, storyId, container))
    .all() as { id: string; rank: string }[];
}

/**
 * The rank changes that put a container's rows in `orderedIds` order. Ids not in the container
 * (a row moved elsewhere meanwhile) are ignored, and rows the list leaves out keep their relative
 * order after it: an order built from a list that went stale still lands, on the rows that are
 * there now.
 */
export function planContainerOrderSync(
  db: AppDrizzleClient,
  entityType: ArrangedEntityType,
  storyId: string,
  container: ArrangedContainer,
  orderedIds: readonly string[],
): Map<string, string> {
  const rows = arrangedRowsSync(db, entityType, storyId, container);
  const present = new Set(rows.map((row) => row.id));
  return planRankChanges(
    rows,
    orderedIds.filter((id) => present.has(id)),
  );
}

/**
 * The rank placing row `id` at `position` (0-based; the end when absent or past it) among a
 * container's other rows - plus the rare re-rank of a neighbour a tie leaves no room beside.
 */
export function planPlacementSync(
  db: AppDrizzleClient,
  entityType: ArrangedEntityType,
  storyId: string,
  container: ArrangedContainer,
  id: string,
  position?: number,
): Map<string, string> {
  const others = arrangedRowsSync(db, entityType, storyId, container).filter(
    (row) => row.id !== id,
  );
  const ordered = [...others].sort(compareRanked).map((row) => row.id);
  const at =
    position === undefined ? ordered.length : Math.min(Math.max(position, 0), ordered.length);
  ordered.splice(at, 0, id);
  return planRankChanges(others, ordered);
}

/**
 * Writes rank changes as edits of the rows they move: the rank and the version, and one update
 * operation per row. `skip` names rows the caller writes itself (a create, or a move carrying its
 * new rank with the rest of its edit).
 */
export function writeRankChangesSync(
  db: AppDrizzleClient,
  storyId: string,
  userIdToLog: string,
  entityType: ArrangedEntityType,
  changes: ReadonlyMap<string, string>,
  skip: ReadonlySet<string> = new Set(),
): string[] {
  const table = TABLES[entityType] as any;
  const written: string[] = [];
  const now = new Date();
  for (const [id, rank] of changes) {
    if (skip.has(id)) continue;
    const row = db
      .update(table)
      .set({ rank, updatedAt: now, version: sql`${table.version} + 1` })
      .where(eq(table.id, id))
      .returning({ version: table.version })
      .get() as { version: number } | undefined;
    if (!row) continue;
    recordLocalOperationSync(db, storyId, userIdToLog, 'update', entityType, id, {
      rank,
      version: row.version,
    });
    written.push(id);
  }
  return written;
}
