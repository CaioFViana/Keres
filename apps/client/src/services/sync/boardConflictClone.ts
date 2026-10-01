import { validateBoardContent } from '@keres/shared';
import { and, eq, ne } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import type { PendingConflict } from '../SyncConflictService';
import { createBoardService } from '../storymanagement/BoardService';

/**
 * Keep the server's board, and this device's drawing as a new board beside it: two layouts cannot
 * be merged, but neither is lost. The copy commits before the keep-server half runs.
 */
export async function cloneConflictBoard(
  db: AppDrizzleClient,
  conflict: PendingConflict,
  currentUserId: string,
  cloneName: string,
): Promise<void> {
  const original = await db.query.boards.findFirst({
    where: eq(schema.boards.id, conflict.entityId),
  });
  const rawContent = conflict.localValues.content ?? original?.content;
  const content = validateBoardContent(rawContent ?? { nodes: [], edges: [] });
  const name = cloneName.slice(0, 120);
  // Idempotency: the clone commits before keepServer runs, so a failure between the two (or
  // a retried tap) re-enters with the copy already saved. A live board with the same name
  // and byte-identical content - other than the conflict's own row - is that copy: skip the
  // create and finish the keepServer half. The entityId exclusion matters: naming the clone
  // exactly like an unchanged original would otherwise match the original itself and lose
  // the user's copy to the keepServer overwrite below.
  const wanted = JSON.stringify(content);
  const sameName = await db.query.boards.findMany({
    where: and(
      eq(schema.boards.storyId, conflict.storyId),
      eq(schema.boards.name, name),
      eq(schema.boards.isDeleted, false),
      ne(schema.boards.id, conflict.entityId),
    ),
    columns: { id: true, content: true },
  });
  const alreadyCloned = sameName.some((row) => {
    try {
      return JSON.stringify(row.content ?? null) === wanted;
    } catch {
      return false;
    }
  });
  if (!alreadyCloned) {
    await createBoardService(db).createBoard(currentUserId, {
      storyId: conflict.storyId,
      name,
      description: original?.description ?? null,
      content,
    });
  }
}
