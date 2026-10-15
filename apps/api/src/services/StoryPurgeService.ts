import { type Column, eq, getTableColumns, getTableName, is, Table } from 'drizzle-orm';
import type { CompatibleDb } from '@/db';
import * as schema from '@/db/schema';

type StoryScopedTable = Table & { storyId: Column };

/** Every table whose rows belong to a story (they all carry a `storyId`), except the story row itself. */
function storyScopedTables(): { name: string; table: StoryScopedTable }[] {
  const found: { name: string; table: StoryScopedTable }[] = [];
  for (const value of Object.values(schema)) {
    if (!is(value, Table)) continue;
    if (!('storyId' in getTableColumns(value))) continue;
    found.push({ name: getTableName(value), table: value as StoryScopedTable });
  }
  return found;
}

/**
 * Erases a story from the server for good: every row of every table that belongs to it, then the story
 * itself. Unlinking a story from a server only marks it deleted (so that a collaborator's device can learn it is
 * gone), which leaves all of its data in place; this is what finally removes it, when the owner sends the
 * story to the server again. Media files are not touched: they are stored by content and may be in use
 * by another story.
 *
 * The tables hold foreign keys among themselves and the order they depend on is not written down anywhere
 * but in the schema, so each is tried in a savepoint and the ones the database refuses (a parent still
 * referenced) wait for the next pass. A pass that clears nothing means something outside the story still
 * points into it; that is raised rather than looped on.
 */
export async function purgeStoryData(tx: CompatibleDb, storyId: string): Promise<void> {
  let waiting = storyScopedTables();
  while (waiting.length > 0) {
    const refused: typeof waiting = [];
    let lastError: unknown;
    for (const entry of waiting) {
      try {
        await tx.transaction(async (savepoint) => {
          await savepoint
            .delete(entry.table as never)
            .where(eq((entry.table as StoryScopedTable).storyId, storyId));
        });
      } catch (error) {
        refused.push(entry);
        lastError = error;
      }
    }
    if (refused.length === waiting.length) {
      throw new Error(
        `Could not erase the story's data: ${refused.map((entry) => entry.name).join(', ')} still referenced.`,
        { cause: lastError },
      );
    }
    waiting = refused;
  }
  await tx.delete(schema.stories).where(eq(schema.stories.id, storyId));
}
