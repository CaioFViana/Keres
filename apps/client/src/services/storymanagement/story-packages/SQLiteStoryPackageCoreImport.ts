import { scenesToUnflag } from '@keres/shared';
import { eq } from 'drizzle-orm';
import type {
  ChapterInsert,
  CharacterInsert,
  ChoiceCheckGroupInsert,
  ChoiceInsert,
  LocationInsert,
  LocationRelationInsert,
  NoteInsert,
  SceneInsert,
  StoryInsert,
  SuggestionInsert,
  TagInsert,
  WorldRuleInsert,
} from '../../../db/schema';
import {
  boards,
  chapterAnchors,
  chapters,
  characters,
  choiceCheckGroups,
  choices,
  locationMaps,
  locationRelations,
  locations,
  notes,
  scenes,
  stories,
  storyArcs,
  storyCalendars,
  suggestions,
  tags,
  worldRules,
} from '../../../db/schema';
import type { SQLiteStoryPackageImportContext } from './SQLiteStoryPackageImportContext';

/**
 * Writes the story root and the collections that establish its main graph before later import
 * phases add relations, assets and terminal metadata. It also normalizes linear-scene endpoints
 * in the caller-owned SQLite transaction.
 */
export async function importStoryPackageCore(
  context: SQLiteStoryPackageImportContext,
): Promise<void> {
  const { fullStory, queriedServerId, role, tx, userId } = context;
  const story = fullStory.story;
  const storyToInsert: StoryInsert = {
    ...story,
    userId,
    createdAt: new Date(story.createdAt),
    updatedAt: new Date(),
    version: story.version,
    isDeleted: false,
    deletedAt: null,
    lastOperationLog: fullStory.serverLastOperationVersion,
    lastServerSyncedLog: fullStory.serverLastOperationVersion,
    serverId: queriedServerId,
    // The server-linked row must have the role pulled by the caller; permission checks fail
    // closed while that role is unknown.
    myRole: queriedServerId ? role : null,
  };
  await tx.insert(stories).values(storyToInsert).run();

  // Chapters may point at arcs, so the parent collection must precede them even when SQLite
  // would allow the opposite order.
  for (const arc of fullStory.storyArcs ?? []) {
    await tx
      .insert(storyArcs)
      .values({
        ...arc,
        storyId: arc.storyId,
        createdAt: new Date(arc.createdAt),
        updatedAt: new Date(),
        version: arc.version,
        isDeleted: false,
        deletedAt: null,
      })
      .run();
  }

  for (const chapter of fullStory.chapters) {
    const row: ChapterInsert = {
      ...chapter,
      storyId: chapter.storyId,
      createdAt: new Date(chapter.createdAt),
      updatedAt: new Date(),
      version: chapter.version,
      isDeleted: false,
      deletedAt: null,
    };
    await tx.insert(chapters).values(row).run();
  }

  // A scene can name a location, so locations also precede scenes.
  for (const location of fullStory.locations) {
    const row: LocationInsert = {
      ...location,
      storyId: location.storyId,
      createdAt: new Date(location.createdAt),
      updatedAt: new Date(),
      version: location.version,
      isDeleted: false,
      deletedAt: null,
    };
    await tx.insert(locations).values(row).run();
  }

  for (const scene of fullStory.scenes) {
    const row: SceneInsert = {
      ...scene,
      storyId: scene.storyId,
      chapterId: scene.chapterId,
      locationId: scene.locationId,
      createdAt: new Date(scene.createdAt),
      updatedAt: new Date(),
      version: scene.version,
      isDeleted: false,
      deletedAt: null,
    };
    await tx.insert(scenes).values(row).run();
  }

  if (storyToInsert.type === 'linear') {
    const importedScenes = await tx.query.scenes.findMany({
      where: eq(scenes.storyId, storyToInsert.id),
      columns: { id: true, isStart: true, isFinish: true, version: true },
    });
    const now = new Date();
    const unflag = scenesToUnflag(importedScenes);
    const versionOf = new Map(importedScenes.map((scene) => [scene.id, scene.version]));
    for (const sceneId of unflag.start) {
      await tx
        .update(scenes)
        .set({ isStart: false, updatedAt: now, version: (versionOf.get(sceneId) ?? 0) + 1 })
        .where(eq(scenes.id, sceneId));
    }
    for (const sceneId of unflag.finish) {
      await tx
        .update(scenes)
        .set({ isFinish: false, updatedAt: now, version: (versionOf.get(sceneId) ?? 0) + 1 })
        .where(eq(scenes.id, sceneId));
    }
  }

  for (const choice of fullStory.choices) {
    const row: ChoiceInsert = {
      ...choice,
      storyId: choice.storyId,
      sceneId: choice.sceneId,
      nextSceneId: choice.nextSceneId,
      createdAt: new Date(choice.createdAt),
      updatedAt: new Date(),
      version: choice.version,
      isDeleted: false,
      deletedAt: null,
    };
    await tx.insert(choices).values(row).run();
  }

  // Check groups precede their checks. Checks and effects wait for items in the assets phase.
  if (fullStory.choiceCheckGroups) {
    for (const group of fullStory.choiceCheckGroups) {
      const row: ChoiceCheckGroupInsert = {
        ...group,
        storyId: group.storyId,
        choiceId: group.choiceId,
        createdAt: new Date(group.createdAt),
        updatedAt: new Date(),
        version: group.version,
        isDeleted: false,
        deletedAt: null,
      };
      await tx.insert(choiceCheckGroups).values(row).run();
    }
  }

  for (const character of fullStory.characters) {
    const row: CharacterInsert = {
      ...character,
      storyId: character.storyId,
      createdAt: new Date(character.createdAt),
      updatedAt: new Date(),
      version: character.version,
      isDeleted: false,
      deletedAt: null,
    };
    await tx.insert(characters).values(row).run();
  }

  if (fullStory.locationRelations) {
    for (const relation of fullStory.locationRelations) {
      const row: LocationRelationInsert = {
        ...relation,
        storyId: relation.storyId,
        createdAt: new Date(relation.createdAt),
        updatedAt: new Date(),
        version: relation.version,
        isDeleted: false,
        deletedAt: null,
      };
      await tx.insert(locationRelations).values(row).run();
    }
  }

  for (const worldRule of fullStory.worldRules) {
    const row: WorldRuleInsert = {
      ...worldRule,
      storyId: worldRule.storyId,
      createdAt: new Date(worldRule.createdAt),
      updatedAt: new Date(),
      version: worldRule.version,
      isDeleted: false,
      deletedAt: null,
    };
    await tx.insert(worldRules).values(row).run();
  }

  for (const note of fullStory.notes) {
    const row: NoteInsert = {
      ...note,
      storyId: note.storyId,
      createdAt: new Date(note.createdAt),
      updatedAt: new Date(),
      version: note.version,
      isDeleted: false,
      deletedAt: null,
    };
    await tx.insert(notes).values(row).run();
  }

  for (const tag of fullStory.tags) {
    const row: TagInsert = {
      ...tag,
      storyId: tag.storyId,
      createdAt: new Date(tag.createdAt),
      updatedAt: new Date(),
      version: tag.version,
      isDeleted: false,
      deletedAt: null,
    };
    await tx.insert(tags).values(row).run();
  }

  for (const suggestion of fullStory.suggestions) {
    const row: SuggestionInsert = {
      ...suggestion,
      storyId: suggestion.storyId,
      createdAt: new Date(suggestion.createdAt),
      updatedAt: new Date(),
      version: suggestion.version,
      isDeleted: false,
      deletedAt: null,
    };
    await tx.insert(suggestions).values(row).run();
  }

  for (const calendar of fullStory.storyCalendars ?? []) {
    await tx
      .insert(storyCalendars)
      .values({
        ...calendar,
        storyId: calendar.storyId,
        createdAt: new Date(calendar.createdAt),
        updatedAt: new Date(),
        version: calendar.version,
        isDeleted: false,
        deletedAt: null,
      })
      .run();
  }

  // Entity references in boards and location maps have already been remapped for local clones.
  for (const board of fullStory.storyBoards ?? []) {
    await tx
      .insert(boards)
      .values({
        ...board,
        storyId: board.storyId,
        createdAt: new Date(board.createdAt),
        updatedAt: new Date(),
        version: board.version,
        isDeleted: false,
        deletedAt: null,
      })
      .run();
  }
  for (const map of fullStory.storyLocationMaps ?? []) {
    await tx
      .insert(locationMaps)
      .values({
        ...map,
        storyId: map.storyId,
        createdAt: new Date(map.createdAt),
        updatedAt: new Date(),
        version: map.version,
        isDeleted: false,
        deletedAt: null,
      })
      .run();
  }
  for (const anchor of fullStory.chapterAnchors ?? []) {
    await tx
      .insert(chapterAnchors)
      .values({
        ...anchor,
        storyId: anchor.storyId,
        createdAt: new Date(anchor.createdAt),
        updatedAt: new Date(),
        version: anchor.version,
        isDeleted: false,
        deletedAt: null,
      })
      .run();
  }
}
