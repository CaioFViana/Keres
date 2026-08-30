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
  plotScenes,
  plots,
  scenes,
  seeAlsoRelations,
  statRelations,
  stats,
  statStrengths,
  stories,
  storyCalendars,
  storyPermissions,
  storySchemaFields,
  suggestions,
  syncConflicts,
  tagRelations,
  tags,
  worldRules,
} from '../../db/schema';

/** Removes every story-owned record, including local sync state that must never survive a cache purge. */
export async function deleteStoryChildRows(
  tx: AppDrizzleTransaction,
  storyId: string,
): Promise<void> {
  await tx.delete(attributeValues).where(eq(attributeValues.storyId, storyId)).run();
  await tx.delete(comments).where(eq(comments.storyId, storyId)).run();
  await tx.delete(favorites).where(eq(favorites.storyId, storyId)).run();
  await tx.delete(chapters).where(eq(chapters.storyId, storyId)).run();
  await tx.delete(chapterAnchors).where(eq(chapterAnchors.storyId, storyId)).run();
  await tx.delete(storyCalendars).where(eq(storyCalendars.storyId, storyId)).run();
  await tx.delete(boards).where(eq(boards.storyId, storyId)).run();
  await tx.delete(characterRelations).where(eq(characterRelations.storyId, storyId)).run();
  await tx.delete(characterScenes).where(eq(characterScenes.storyId, storyId)).run();
  await tx.delete(characters).where(eq(characters.storyId, storyId)).run();
  await tx.delete(choiceChecks).where(eq(choiceChecks.storyId, storyId)).run();
  await tx.delete(choiceCheckGroups).where(eq(choiceCheckGroups.storyId, storyId)).run();
  await tx.delete(choices).where(eq(choices.storyId, storyId)).run();
  await tx.delete(effects).where(eq(effects.storyId, storyId)).run();
  await tx.delete(galleryRelations).where(eq(galleryRelations.storyId, storyId)).run();
  await tx.delete(galleries).where(eq(galleries.storyId, storyId)).run();
  await tx.delete(itemJourneys).where(eq(itemJourneys.storyId, storyId)).run();
  await tx.delete(items).where(eq(items.storyId, storyId)).run();
  await tx.delete(locationMaps).where(eq(locationMaps.storyId, storyId)).run();
  await tx.delete(locationRelations).where(eq(locationRelations.storyId, storyId)).run();
  await tx.delete(locations).where(eq(locations.storyId, storyId)).run();
  await tx.delete(noteRelations).where(eq(noteRelations.storyId, storyId)).run();
  await tx.delete(notes).where(eq(notes.storyId, storyId)).run();
  await tx.delete(operationLogs).where(eq(operationLogs.storyId, storyId)).run();
  await tx.delete(plotScenes).where(eq(plotScenes.storyId, storyId)).run();
  await tx.delete(plots).where(eq(plots.storyId, storyId)).run();
  await tx.delete(scenes).where(eq(scenes.storyId, storyId)).run();
  await tx.delete(seeAlsoRelations).where(eq(seeAlsoRelations.storyId, storyId)).run();
  await tx.delete(storyPermissions).where(eq(storyPermissions.storyId, storyId)).run();
  await tx.delete(statRelations).where(eq(statRelations.storyId, storyId)).run();
  await tx.delete(statStrengths).where(eq(statStrengths.storyId, storyId)).run();
  await tx.delete(stats).where(eq(stats.storyId, storyId)).run();
  await tx.delete(modes).where(eq(modes.storyId, storyId)).run();
  await tx.delete(storySchemaFields).where(eq(storySchemaFields.storyId, storyId)).run();
  await tx.delete(suggestions).where(eq(suggestions.storyId, storyId)).run();
  await tx.delete(syncConflicts).where(eq(syncConflicts.storyId, storyId)).run();
  await tx.delete(tagRelations).where(eq(tagRelations.storyId, storyId)).run();
  await tx.delete(tags).where(eq(tags.storyId, storyId)).run();
  await tx.delete(worldRules).where(eq(worldRules.storyId, storyId)).run();
}

/** Permanently removes a story's local cache; callers decide whether any server must be notified first. */
export async function purgeStoryLocally(db: AppDrizzleClient, storyId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await deleteStoryChildRows(tx, storyId);
    await tx.delete(stories).where(eq(stories.id, storyId)).run();
  });
}
