import type { ChapterReorderingStoryUpdate, StoryReorderingStoryUpdate } from '@keres/shared';
import { eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient, AppDrizzleTransaction } from '../../db';
import * as schema from '../../db/schema';

/**
 * Applies a remote reorder (or the server's version of one that conflicted) to the local database. It
 * lives in its own module because three callers need it - the pull applier, the pull reconciler, and
 * `resolveKeepServer` for the reorder case - and none of them may depend on the others.
 */
export async function applyReorderToLocalDb(
  db: AppDrizzleClient,
  update: ChapterReorderingStoryUpdate | StoryReorderingStoryUpdate,
  operationTime: Date,
  options?: { bumpVersions?: boolean; tx?: AppDrizzleTransaction },
): Promise<void> {
  const { reorderItems } = update;
  if (!reorderItems || reorderItems.length === 0) return;
  // Resolving keep-server re-applies the arrangement over rows the abandoned local op already
  // bumped: bumping again would count the speculation twice, so the resolution applies the
  // order without touching versions and aligns the container separately instead.
  const bumpVersions = options?.bumpVersions !== false;

  if (update.entity === 'Story') {
    const target = (update as StoryReorderingStoryUpdate).reorderTarget;
    if (
      target !== undefined &&
      target !== 'Event' &&
      target !== 'StorySchemaField' &&
      target !== 'Stat'
    ) {
      // A target this build does not reorder (a newer server's collection): the chapters
      // branch below matches no rows by id, so this degrades to a no-op rather than
      // corrupting anything - but it is worth one line in the log.
      console.warn(
        `applyReorderToLocalDb: unrecognised reorder target '${target}', skipping items.`,
      );
    }
  }

  // A caller holding its own transaction passes it in, so the reorder joins that unit
  // instead of nesting a second transaction inside it.
  const run = async (tx: AppDrizzleClient | AppDrizzleTransaction): Promise<void> => {
    for (const item of reorderItems) {
      if (update.entity === 'Chapter') {
        // Reordering scenes within a chapter
        await tx
          .update(schema.scenes)
          .set({
            index: item.newIndex,
            updatedAt: operationTime,
            version: bumpVersions ? sql`${schema.scenes.version} + 1` : undefined,
          })
          .where(eq(schema.scenes.id, item.id));
      } else if (
        update.entity === 'Story' &&
        (update as StoryReorderingStoryUpdate).reorderTarget === 'StorySchemaField'
      ) {
        await tx
          .update(schema.storySchemaFields)
          .set({
            order: item.newIndex - 1,
            updatedAt: operationTime,
            version: bumpVersions ? sql`${schema.storySchemaFields.version} + 1` : undefined,
          })
          .where(eq(schema.storySchemaFields.id, item.id));
      } else if (
        update.entity === 'Story' &&
        (update as StoryReorderingStoryUpdate).reorderTarget === 'Stat'
      ) {
        await tx
          .update(schema.stats)
          .set({
            order: item.newIndex - 1,
            updatedAt: operationTime,
            version: bumpVersions ? sql`${schema.stats.version} + 1` : undefined,
          })
          .where(eq(schema.stats.id, item.id));
      } else if (update.entity === 'Story') {
        // Reordering chapters (or events, which share their table) within a story
        await tx
          .update(schema.chapters)
          .set({
            index: item.newIndex,
            updatedAt: operationTime,
            version: bumpVersions ? sql`${schema.chapters.version} + 1` : undefined,
          })
          .where(eq(schema.chapters.id, item.id));
      }
    }

    // The container bumps with its rows: the server bumps it once per applied reorder, so an
    // applier that skips this would base its next container edit on a stale version.
    if (bumpVersions && update.id) {
      if (update.entity === 'Chapter') {
        await tx
          .update(schema.chapters)
          .set({
            updatedAt: operationTime,
            version: sql`${schema.chapters.version} + 1`,
          })
          .where(eq(schema.chapters.id, update.id));
      } else if (update.entity === 'Story') {
        await tx
          .update(schema.stories)
          .set({
            updatedAt: operationTime,
            version: sql`${schema.stories.version} + 1`,
          })
          .where(eq(schema.stories.id, update.id));
      }
    }
  };

  if (options?.tx) {
    await run(options.tx);
  } else {
    await db.transaction(run);
  }
}
