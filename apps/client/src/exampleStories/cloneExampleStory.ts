import { FullStoryExportSchema, type FullStoryExportType } from '@keres/shared';
import { createULID } from '../utils/entityUtils';

type EntityWithId = { id: string };

/**
 * Cria uma cópia independente de uma história local antes de instalá-la ou importá-la.
 *
 * Arquivos empacotados e exports locais podem ter IDs que já existem no aparelho. Todos os
 * IDs são substituídos antes da escrita, incluindo os vínculos internos, para que a origem
 * permaneça intacta e a cópia possa ser importada mais de uma vez.
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
      // Uma instalação é uma nova história local, não uma restauração do histórico do pacote.
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
      chapterId: remapId(scene.chapterId),
      locationId: remapId(scene.locationId),
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
    suggestions: example.suggestions.map((suggestion) => ({ ...cloneEntity(suggestion), storyId })),
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
      // Nulo é a escada padrão da história e continua nulo na cópia.
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
    // O cursor pertence ao servidor de origem, não à cópia recém-instalada.
    serverLastOperationVersion: 0,
  };

  // Mantém esta função segura caso um exemplo novo introduza um vínculo inválido.
  return FullStoryExportSchema.parse(cloned);
}
