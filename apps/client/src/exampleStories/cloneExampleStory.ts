import { FullStoryExportSchema, type FullStoryExportType } from '@keres/shared';
import { createULID } from '../utils/entityUtils';

type EntityWithId = { id: string };

/**
 * Creates an independent copy of a local story before installing or importing it.
 *
 * Packaged files and local exports can carry IDs that already exist on the device. Every ID is replaced
 * before writing, internal links included, so the source stays intact and the copy can be imported more
 * than once.
 */
export function cloneExampleStoryForInstall(
  example: FullStoryExportType,
  userId: string,
  targetStoryId?: string,
): FullStoryExportType {
  const idMap = new Map<string, string>();
  const register = (entity: EntityWithId) => idMap.set(entity.id, createULID());
  const registerAll = (entities: readonly EntityWithId[] | undefined) =>
    entities?.forEach(register);

  register(example.story);
  if (targetStoryId) idMap.set(example.story.id, targetStoryId);
  registerAll(example.chapters);
  registerAll(example.scenes);
  registerAll(example.choices);
  registerAll(example.choiceCheckGroups);
  registerAll(example.choiceChecks);
  registerAll(example.effects);
  registerAll(example.characters);
  registerAll(example.locations);
  registerAll(example.worldRules);
  registerAll(example.notes);
  registerAll(example.noteRelations);
  registerAll(example.tags);
  registerAll(example.tagRelations);
  registerAll(example.suggestions);
  registerAll(example.chapterAnchors);
  registerAll(example.storyCalendars);
  registerAll(example.characterRelations);
  registerAll(example.characterScenes);
  registerAll(example.plots);
  registerAll(example.plotScenes);
  registerAll(example.galleryItems);
  registerAll(example.galleryRelations);
  registerAll(example.items);
  registerAll(example.itemJourneys);
  registerAll(example.storySchemaFields);
  registerAll(example.attributeValues);
  registerAll(example.comments);
  registerAll(example.seeAlsoRelations);
  registerAll(example.favorites);
  registerAll(example.locationRelations);
  registerAll(example.stats);
  registerAll(example.statStrengths);
  registerAll(example.statRelations);
  registerAll(example.modes);

  const remapId = (id: string) => idMap.get(id) ?? id;
  /**
   * A `Suggestion.type` of `custom:<fieldId>` is a text column that is secretly an id: it is built
   * from the live field id by `SuggestionService.customAttributeSuggestionType`. Remapping the
   * fields without remapping this leaves every custom field's catalogue pointing at the id it had
   * in the source - the field works, the suggestions are simply never found. Silent, and it applied
   * to every installed example story and every imported `.json` until this was added.
   *
   * `list_<ulid>_<slug>` needs no such treatment: that ULID is minted by `namedListType` for the
   * list itself, is not an entity id, and stays consistent with its catalogue entry precisely
   * because neither side is remapped.
   */
  const CUSTOM_SUGGESTION_PREFIX = 'custom:';
  const remapSuggestionType = (type: string) =>
    type.startsWith(CUSTOM_SUGGESTION_PREFIX)
      ? `${CUSTOM_SUGGESTION_PREFIX}${remapId(type.slice(CUSTOM_SUGGESTION_PREFIX.length))}`
      : type;
  const remapNullableId = (id: string | null) => (id === null ? null : remapId(id));
  const cloneEntity = <T extends EntityWithId>(entity: T): T => ({
    ...entity,
    id: remapId(entity.id),
  });
  const storyId = remapId(example.story.id);
  const entityFieldIds = new Set(
    example.storySchemaFields?.filter((field) => field.type === 'entity').map((field) => field.id),
  );

  const cloned: FullStoryExportType = {
    ...example,
    story: {
      ...cloneEntity(example.story),
      id: storyId,
      userId,
      // An installation is a new local story, not a restoration of the package's history.
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      isDeleted: false,
      deletedAt: null,
    },
    chapters: example.chapters.map((chapter) => ({ ...cloneEntity(chapter), storyId })),
    scenes: example.scenes.map((scene) => ({
      ...cloneEntity(scene),
      storyId,
      chapterId: remapNullableId(scene.chapterId),
      // A scene may have no place at all; there is then nothing to remap.
      locationId: scene.locationId ? remapId(scene.locationId) : null,
    })),
    choices: example.choices.map((choice) => ({
      ...cloneEntity(choice),
      storyId,
      sceneId: remapId(choice.sceneId),
      nextSceneId: remapId(choice.nextSceneId),
    })),
    choiceCheckGroups: example.choiceCheckGroups?.map((group) => ({
      ...cloneEntity(group),
      storyId,
      choiceId: remapId(group.choiceId),
    })),
    choiceChecks: example.choiceChecks?.map((check) => ({
      ...cloneEntity(check),
      storyId,
      groupId: remapId(check.groupId),
      sceneId: remapNullableId(check.sceneId),
      itemId: remapNullableId(check.itemId),
    })),
    effects: example.effects?.map((effect) => ({
      ...cloneEntity(effect),
      storyId,
      entityId: remapId(effect.entityId),
      itemId: remapNullableId(effect.itemId),
    })),
    characters: example.characters.map((character) => ({ ...cloneEntity(character), storyId })),
    locations: example.locations.map((location) => ({ ...cloneEntity(location), storyId })),
    worldRules: example.worldRules.map((worldRule) => ({ ...cloneEntity(worldRule), storyId })),
    notes: example.notes.map((note) => ({ ...cloneEntity(note), storyId })),
    noteRelations: example.noteRelations.map((relation) => ({
      ...cloneEntity(relation),
      storyId,
      noteId: remapId(relation.noteId),
      relationId: remapId(relation.relationId),
    })),
    tags: example.tags.map((tag) => ({ ...cloneEntity(tag), storyId })),
    tagRelations: example.tagRelations.map((relation) => ({
      ...cloneEntity(relation),
      storyId,
      tagId: remapId(relation.tagId),
      relationId: remapId(relation.relationId),
    })),
    suggestions: example.suggestions.map((suggestion) => ({
      ...cloneEntity(suggestion),
      storyId,
      type: remapSuggestionType(suggestion.type),
    })),
    chapterAnchors: example.chapterAnchors?.map((anchor) => ({
      ...cloneEntity(anchor),
      storyId,
      chapterId: remapId(anchor.chapterId),
      startSceneId: remapId(anchor.startSceneId),
      endSceneId: remapNullableId(anchor.endSceneId),
    })),
    storyCalendars: example.storyCalendars?.map((calendar) => ({
      ...cloneEntity(calendar),
      storyId,
    })),
    characterRelations: example.characterRelations.map((relation) => ({
      ...cloneEntity(relation),
      storyId,
      character1Id: remapId(relation.character1Id),
      character2Id: remapId(relation.character2Id),
    })),
    characterScenes: example.characterScenes.map((relation) => ({
      ...cloneEntity(relation),
      storyId,
      characterId: remapId(relation.characterId),
      sceneId: remapId(relation.sceneId),
    })),
    plots: example.plots?.map((plot) => ({ ...cloneEntity(plot), storyId })),
    plotScenes: example.plotScenes?.map((relation) => ({
      ...cloneEntity(relation),
      storyId,
      plotId: remapId(relation.plotId),
      sceneId: remapId(relation.sceneId),
    })),
    galleryItems: example.galleryItems.map((item) => ({ ...cloneEntity(item), storyId })),
    galleryRelations: example.galleryRelations?.map((relation) => ({
      ...cloneEntity(relation),
      storyId,
      galleryId: remapId(relation.galleryId),
      ownerId: remapId(relation.ownerId),
    })),
    items: example.items?.map((item) => ({
      ...cloneEntity(item),
      storyId,
      characterOwnerId: remapNullableId(item.characterOwnerId),
    })),
    itemJourneys: example.itemJourneys.map((journey) => ({
      ...cloneEntity(journey),
      storyId,
      itemId: remapId(journey.itemId),
      sceneId: remapId(journey.sceneId),
      newCharacterOwnerId: remapNullableId(journey.newCharacterOwnerId),
    })),
    storySchemaFields: example.storySchemaFields?.map((field) => ({
      ...cloneEntity(field),
      storyId,
    })),
    attributeValues: example.attributeValues?.map((value) => ({
      ...cloneEntity(value),
      storyId,
      entityId: remapId(value.entityId),
      fieldId: remapId(value.fieldId),
      value:
        entityFieldIds.has(value.fieldId) && value.value
          ? (idMap.get(value.value) ?? null)
          : value.value,
    })),
    comments: example.comments?.map((comment) => ({
      ...cloneEntity(comment),
      storyId,
      entityId: remapId(comment.entityId),
      fieldId: remapNullableId(comment.fieldId),
      authorUserId: userId,
    })),
    seeAlsoRelations: example.seeAlsoRelations?.map((relation) => ({
      ...cloneEntity(relation),
      storyId,
      entityAId: remapId(relation.entityAId),
      entityBId: remapId(relation.entityBId),
    })),
    favorites: example.favorites?.map((favorite) => ({
      ...cloneEntity(favorite),
      storyId,
      entityId: remapId(favorite.entityId),
      userId,
    })),
    locationRelations: example.locationRelations?.map((relation) => ({
      ...cloneEntity(relation),
      storyId,
      locationAId: remapId(relation.locationAId),
      locationBId: remapId(relation.locationBId),
    })),
    stats: example.stats?.map((stat) => ({ ...cloneEntity(stat), storyId })),
    statStrengths: example.statStrengths?.map((strength) => ({
      ...cloneEntity(strength),
      storyId,
      // Null is the story's default ladder and stays null in the copy.
      statId: remapNullableId(strength.statId),
    })),
    statRelations: example.statRelations?.map((value) => ({
      ...cloneEntity(value),
      storyId,
      characterId: remapId(value.characterId),
      statId: remapId(value.statId),
      modeId: remapNullableId(value.modeId),
    })),
    modes: example.modes?.map((mode) => ({
      ...cloneEntity(mode),
      storyId,
      characterId: remapId(mode.characterId),
    })),
    // The cursor belongs to the source server, not to the freshly installed copy.
    serverLastOperationVersion: 0,
  };

  // It keeps this function safe should a new example introduce an invalid link.
  return FullStoryExportSchema.parse(cloned);
}
