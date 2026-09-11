import { eq } from 'drizzle-orm';
import type { AppDrizzleClient, AppDrizzleTransaction } from '../../db';
import {
  attributeValues,
  boards,
  chapterAnchors,
  chapters,
  characterRelations,
  characters,
  characterScenes,
  choiceCheckGroups,
  choiceChecks,
  choices,
  comments,
  effects,
  favorites,
  galleries,
  galleryRelations,
  itemJourneys,
  items,
  locationMaps,
  locationRelations,
  locations,
  modes,
  noteRelations,
  notes,
  operationLogs,
  packs,
  plotScenes,
  plots,
  routes,
  routeSteps,
  scenes,
  seeAlsoRelations,
  statRelations,
  stats,
  statStrengths,
  stories,
  storyArcs,
  storyCalendars,
  storyPermissions,
  storyPublications,
  storySchemaFields,
  suggestions,
  syncConflicts,
  tagRelations,
  tags,
  worldRules,
} from '../../db/schema';

/**
 * Tables whose rows are owned by a story and must disappear with its local copy. The schema test
 * asserts this list covers every table exposing a `storyId` column, including non-sync caches.
 */
export const STORY_CHILD_TABLES = [
  attributeValues,
  comments,
  favorites,
  chapters,
  chapterAnchors,
  storyCalendars,
  storyArcs,
  boards,
  characterRelations,
  characterScenes,
  characters,
  choiceChecks,
  choiceCheckGroups,
  choices,
  effects,
  galleryRelations,
  galleries,
  itemJourneys,
  items,
  locationMaps,
  locationRelations,
  locations,
  noteRelations,
  notes,
  operationLogs,
  plotScenes,
  plots,
  routeSteps,
  routes,
  scenes,
  seeAlsoRelations,
  storyPermissions,
  statRelations,
  statStrengths,
  stats,
  modes,
  storyPublications,
  storySchemaFields,
  suggestions,
  syncConflicts,
  tagRelations,
  tags,
  worldRules,
] as const;

/** Removes every story-owned record, including local sync state that must never survive a cache purge. */
export async function deleteStoryChildRows(
  tx: AppDrizzleTransaction,
  storyId: string,
): Promise<void> {
  for (const table of STORY_CHILD_TABLES) {
    await tx.delete(table).where(eq(table.storyId, storyId)).run();
  }

  // A pack is an independent snapshot and must remain usable after its source story is gone.
  await tx
    .update(packs)
    .set({ sourceStoryId: null, updatedAt: new Date() })
    .where(eq(packs.sourceStoryId, storyId))
    .run();
}

/** Permanently removes a story's local cache; callers decide whether any server must be notified first. */
export async function purgeStoryLocally(db: AppDrizzleClient, storyId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await deleteStoryChildRows(tx, storyId);
    await tx.delete(stories).where(eq(stories.id, storyId)).run();
  });
}
