import type { StoryUpdate } from '@keres/shared';
import { ARRANGED, derivePositions, rankAtPositionOf } from '@keres/shared';
import { eq } from 'drizzle-orm';
import type { CompatibleDb } from '../../db';
import { chapters, scenes, stats, storySchemaFields } from '../../db/schema';

/**
 * Positions of arranged rows on the server: `rank` is the synchronized field, and `index`/`order`
 * are derived from it after every write that can move a row (see `rules/rank.ts`). Derived here in
 * code, never by an SQL sort: Postgres compares text under the database's linguistic collation,
 * which does not order ranks the way every device does.
 */

const ARRANGED_TABLES = {
  Scene: scenes,
  Chapter: chapters,
  Stat: stats,
  StorySchemaField: storySchemaFields,
} as const;

type ArrangedTable = (typeof ARRANGED_TABLES)[keyof typeof ARRANGED_TABLES];
type Column = Parameters<typeof eq>[0];
type ArrangedRow = { id: string; rank: string; isDeleted: boolean; position: number } & Record<
  string,
  unknown
>;

function arrangedTable(entityType: string): ArrangedTable | undefined {
  return (ARRANGED_TABLES as Record<string, ArrangedTable>)[entityType];
}

/**
 * Brings an incoming operation on an arranged row to the rank protocol. Its position is derived, so
 * an update never writes it (a move is a rank edit); a create may state a position instead of a
 * rank, and is ranked from it (`rankAtPositionOf`).
 */
export function normalizeArrangedUpdate(update: StoryUpdate): StoryUpdate {
  const arranged = ARRANGED[update.entity];
  if (!arranged) return update;
  if (update.type === 'create') {
    const data = { ...(update.data ?? {}) } as Record<string, unknown>;
    if (typeof data.rank !== 'string' || data.rank.length === 0) {
      const position = data[arranged.positionField];
      data.rank = rankAtPositionOf(
        update.entity,
        typeof position === 'number' ? position : arranged.base,
      );
    }
    return { ...update, data } as StoryUpdate;
  }
  if (update.type === 'update') {
    const changes = { ...(update.changes ?? {}) } as Record<string, unknown>;
    delete changes[arranged.positionField];
    return { ...update, changes } as StoryUpdate;
  }
  return update;
}

/** Whether a write can change which rows a container holds, or where one sits. */
export function movesArrangedRows(update: StoryUpdate): boolean {
  const arranged = ARRANGED[update.entity];
  if (!arranged) return false;
  if (update.type !== 'update') return update.type === 'create' || update.type === 'delete';
  const changes = (update.changes ?? {}) as Record<string, unknown>;
  return (
    'rank' in changes ||
    'isDeleted' in changes ||
    arranged.containerFields.some((field) => field in changes)
  );
}

/**
 * Derives the positions of one entity's rows in a story from their ranks, giving any row still
 * without a rank the one its position implies first. Touches only rows whose value changes, and
 * never their version: a position is not an edit of the row.
 */
export async function renumberArranged(
  database: CompatibleDb,
  storyId: string,
  entityType: string,
): Promise<void> {
  const arranged = ARRANGED[entityType];
  const table = arrangedTable(entityType);
  if (!arranged || !table) return;
  // The four tables share these columns under the same names; read them by name.
  const column = table as unknown as Record<string, Column>;
  const selected: Record<string, Column> = {
    id: column.id!,
    rank: column.rank!,
    isDeleted: column.isDeleted!,
    position: column[arranged.positionField]!,
  };
  for (const field of arranged.containerFields) selected[field] = column[field]!;
  const rows = (await database
    .select(selected as never)
    .from(table as never)
    .where(eq(column.storyId!, storyId))) as unknown as ArrangedRow[];

  for (const row of rows) {
    if (row.rank) continue;
    row.rank = rankAtPositionOf(entityType, row.position);
    await database
      .update(table as never)
      .set({ rank: row.rank } as never)
      .where(eq(column.id!, row.id));
  }
  const positions = derivePositions(entityType, rows);
  for (const row of rows) {
    const position = positions.get(row.id);
    if (position === undefined || position === row.position) continue;
    await database
      .update(table as never)
      .set({ [arranged.positionField]: position } as never)
      .where(eq(column.id!, row.id));
  }
}

/** Every arranged entity of a story, after a bulk write (an import) placed rows directly. */
export async function renumberAllArranged(database: CompatibleDb, storyId: string): Promise<void> {
  for (const entityType of Object.keys(ARRANGED_TABLES)) {
    await renumberArranged(database, storyId, entityType);
  }
}
