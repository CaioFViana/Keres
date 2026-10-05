import { validateSketchContent } from '@keres/shared';
import { and, eq, ne } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import type { PendingConflict } from '../SyncConflictService';
import { createSketchService } from '../storymanagement/SketchService';

/**
 * Keep the server's sketch, and this device's drawing as a new sketch beside it: two drawings
 * cannot be merged, but neither is lost. The copy commits before the keep-server half runs.
 */
export async function cloneConflictSketch(
  db: AppDrizzleClient,
  conflict: PendingConflict,
  currentUserId: string,
  cloneName: string,
): Promise<void> {
  const original = await db.query.sketches.findFirst({
    where: eq(schema.sketches.id, conflict.entityId),
  });
  const rawContent = conflict.localValues.content ?? original?.content;
  const content = validateSketchContent(
    rawContent ?? { page: { width: 794, height: 1123 }, layers: [], overlays: [] },
  );
  const name = cloneName.slice(0, 120);
  // Idempotency: the clone commits before keepServer runs, so a failure between the two (or
  // a retried tap) re-enters with the copy already saved. A live sketch with the same name
  // and byte-identical content - other than the conflict's own row - is that copy: skip the
  // create and finish the keepServer half. The entityId exclusion matters: naming the clone
  // exactly like an unchanged original would otherwise match the original itself and lose
  // the user's copy to the keepServer overwrite below.
  const wanted = JSON.stringify(content);
  const sameName = await db.query.sketches.findMany({
    where: and(
      eq(schema.sketches.storyId, conflict.storyId),
      eq(schema.sketches.name, name),
      eq(schema.sketches.isDeleted, false),
      ne(schema.sketches.id, conflict.entityId),
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
    await createSketchService(db).createSketch(currentUserId, {
      storyId: conflict.storyId,
      name,
      description: original?.description ?? null,
      content,
    });
  }
}
