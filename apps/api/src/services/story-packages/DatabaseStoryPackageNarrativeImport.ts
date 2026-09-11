import { OperationLogEntityType, sortIdPair } from '@keres/shared';
import type { DatabaseStoryPackageImportContext } from './DatabaseStoryPackageImportContext';
import { insertPortableCollection } from './DatabaseStoryPackageCollectionRepository';

/**
 * Prepares narrative entities after their core references exist: characters, notes, tags, calendars,
 * anchors, and character relationships. Symmetric relationships are normalized before persistence.
 */
export async function importNarrativeCollections(
  context: DatabaseStoryPackageImportContext,
): Promise<void> {
  const { fullStory: validatedFullStory, idMap, nextId, now, targetStoryId } = context;
  // --- Characters ---
  const newCharactersData = validatedFullStory.characters.map((original) => {
    const newId = nextId(original.id);
    idMap.set(original.id, newId);
    return {
      ...original,
      id: newId,
      storyId: targetStoryId,
      version: 1,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      deletedAt: null,
    };
  });
  if (newCharactersData.length > 0) {
    await insertPortableCollection(context, OperationLogEntityType.Character, newCharactersData);
  }

  // --- WorldRules ---
  const newWorldRulesData = validatedFullStory.worldRules.map((original) => {
    const newId = nextId(original.id);
    idMap.set(original.id, newId);
    return {
      ...original,
      id: newId,
      storyId: targetStoryId,
      version: 1,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      deletedAt: null,
    };
  });
  if (newWorldRulesData.length > 0) {
    await insertPortableCollection(context, OperationLogEntityType.WorldRule, newWorldRulesData);
  }

  // --- Notes ---
  const newNotesData = validatedFullStory.notes.map((original) => {
    const newId = nextId(original.id);
    idMap.set(original.id, newId);
    return {
      ...original,
      id: newId,
      storyId: targetStoryId,
      version: 1,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      deletedAt: null,
    };
  });
  if (newNotesData.length > 0) {
    await insertPortableCollection(context, OperationLogEntityType.Note, newNotesData);
  }

  // --- NoteRelations ---
  const newNoteRelationsData = validatedFullStory.noteRelations.map((original) => {
    const newId = nextId(original.id);
    idMap.set(original.id, newId);
    const mappedNoteId = idMap.get(original.noteId);
    if (!mappedNoteId) {
      throw new Error(
        `Import Error: Note ID ${original.noteId} not found in ID map for note relation ${original.id}.`,
      );
    }
    const mappedRelationId = idMap.get(original.relationId);
    if (!mappedRelationId) {
      throw new Error(
        `Import Error: Relation ID ${original.relationId} not found in ID map for note relation ${original.id}. This indicates a missing entity in export or an unhandled foreign key.`,
      );
    }
    return {
      ...original,
      id: newId,
      storyId: targetStoryId,
      noteId: mappedNoteId,
      relationId: mappedRelationId,
      relationType: original.relationType,
      version: 1,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      deletedAt: null,
    };
  });
  if (newNoteRelationsData.length > 0) {
    await insertPortableCollection(
      context,
      OperationLogEntityType.NoteRelation,
      newNoteRelationsData,
    );
  }

  // --- Tags ---
  const newTagsData = validatedFullStory.tags.map((original) => {
    const newId = nextId(original.id);
    idMap.set(original.id, newId);
    return {
      ...original,
      id: newId,
      storyId: targetStoryId,
      version: 1,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      deletedAt: null,
    };
  });
  if (newTagsData.length > 0) {
    await insertPortableCollection(context, OperationLogEntityType.Tag, newTagsData);
  }

  // --- Suggestions ---
  const newSuggestionsData = validatedFullStory.suggestions.map((original) => {
    const newId = nextId(original.id);
    idMap.set(original.id, newId);
    return {
      ...original,
      id: newId,
      storyId: targetStoryId,
      version: 1,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      deletedAt: null,
    };
  });
  if (newSuggestionsData.length > 0) {
    await insertPortableCollection(context, OperationLogEntityType.Suggestion, newSuggestionsData);
  }

  /*
   * --- ChapterAnchors ---
   *
   * The container and the start scene always remap. The end scene is optional: an open stretch
   * has none. A start scene missing from the map is a broken package and still refuses.
   */
  const newChapterAnchorsData = (validatedFullStory.chapterAnchors ?? []).map((original) => {
    const newId = nextId(original.id);
    idMap.set(original.id, newId);
    const mappedChapter = idMap.get(original.chapterId);
    const mappedStart = idMap.get(original.startSceneId);
    const mappedEnd = original.endSceneId ? idMap.get(original.endSceneId) : null;
    if (!mappedChapter || !mappedStart || (original.endSceneId && !mappedEnd)) {
      throw new Error(
        `Import Error: a row referenced by chapter anchor ${original.id} was not found in the ID map.`,
      );
    }
    return {
      ...original,
      id: newId,
      storyId: targetStoryId,
      chapterId: mappedChapter,
      startSceneId: mappedStart,
      endSceneId: mappedEnd ?? null,
      createdAt: new Date(original.createdAt),
      updatedAt: new Date(original.updatedAt),
      deletedAt: original.deletedAt ? new Date(original.deletedAt) : null,
    };
  });
  if (newChapterAnchorsData.length > 0) {
    await insertPortableCollection(
      context,
      OperationLogEntityType.ChapterAnchor,
      newChapterAnchorsData,
    );
  }

  /*
   * --- StoryCalendars ---
   *
   * Nothing to remap: a calendar references no other row. It is the only collection here that
   * is a pure copy, which is the same property that makes it safe to carry in a pack.
   */
  const newStoryCalendarsData = (validatedFullStory.storyCalendars ?? []).map((original) => {
    const newId = nextId(original.id);
    idMap.set(original.id, newId);
    return {
      ...original,
      id: newId,
      storyId: targetStoryId,
      createdAt: new Date(original.createdAt),
      updatedAt: new Date(original.updatedAt),
      deletedAt: original.deletedAt ? new Date(original.deletedAt) : null,
    };
  });
  if (newStoryCalendarsData.length > 0) {
    await insertPortableCollection(
      context,
      OperationLogEntityType.StoryCalendar,
      newStoryCalendarsData,
    );
  }

  // --- CharacterRelations ---
  const newCharacterRelationsData = validatedFullStory.characterRelations.map((original) => {
    const newId = nextId(original.id);
    idMap.set(original.id, newId);
    const mappedCharacterId1 = idMap.get(original.character1Id);
    if (!mappedCharacterId1) {
      throw new Error(
        `Import Error: Character ID 1 ${original.character1Id} not found in ID map for character relation ${original.id}.`,
      );
    }
    const mappedCharacterId2 = idMap.get(original.character2Id);
    if (!mappedCharacterId2) {
      throw new Error(
        `Import Error: Character ID 2 ${original.character2Id} not found in ID map for character relation ${original.id}.`,
      );
    }
    // Sorted, exactly as `CharacterRelationSyncHandler` does before every write. The unique
    // constraint is on the ordered pair, so without this a package carrying (A,B) and (B,A)
    // would install two rows for one relation.
    const [sortedCharacter1Id, sortedCharacter2Id] = sortIdPair(
      mappedCharacterId1,
      mappedCharacterId2,
    );
    return {
      ...original,
      id: newId,
      storyId: targetStoryId,
      character1Id: sortedCharacter1Id,
      character2Id: sortedCharacter2Id,
      version: 1,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      deletedAt: null,
    };
  });
  if (newCharacterRelationsData.length > 0) {
    await insertPortableCollection(
      context,
      OperationLogEntityType.CharacterRelation,
      newCharacterRelationsData,
    );
  }

  // --- CharacterScenes ---
  const newCharacterScenesData = validatedFullStory.characterScenes.map((original) => {
    const newId = nextId(original.id);
    idMap.set(original.id, newId);
    const mappedCharacterId = idMap.get(original.characterId);
    if (!mappedCharacterId) {
      throw new Error(
        `Import Error: Character ID ${original.characterId} not found in ID map for character scene ${original.id}.`,
      );
    }
    const mappedSceneId = idMap.get(original.sceneId);
    if (!mappedSceneId) {
      throw new Error(
        `Import Error: Scene ID ${original.sceneId} not found in ID map for character scene ${original.id}.`,
      );
    }
    return {
      ...original,
      id: newId,
      storyId: targetStoryId,
      characterId: mappedCharacterId,
      sceneId: mappedSceneId,
      version: 1,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      deletedAt: null,
    };
  });
  if (newCharacterScenesData.length > 0) {
    await insertPortableCollection(
      context,
      OperationLogEntityType.CharacterScene,
      newCharacterScenesData,
    );
  }
}
