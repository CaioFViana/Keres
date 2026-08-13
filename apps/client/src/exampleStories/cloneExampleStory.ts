import { FullStoryExportSchema, type FullStoryExportType } from '@keres/shared';
import { createULID } from '../utils/entityUtils';

type EntityWithId = { id: string };

/**
 * Cria uma cópia independente de uma história empacotada antes de instalá-la.
 *
 * Os arquivos de exemplo são conteúdo estático e, por isso, têm IDs fixos. Eles nunca
 * devem ser enviados diretamente ao banco: dois usuários que instalassem o mesmo exemplo
 * acabariam tentando sincronizar as mesmas entidades. Este remapeamento é propositalmente
 * restrito a esse catálogo; importação e exportação comuns preservam seus IDs normalmente.
 */
export function cloneExampleStoryForInstall(
  example: FullStoryExportType,
  userId: string,
): FullStoryExportType {
  const idMap = new Map<string, string>();
  const register = (entity: EntityWithId) => idMap.set(entity.id, createULID());
  const registerAll = (entities: readonly EntityWithId[] | undefined) => entities?.forEach(register);

  register(example.story);
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
  registerAll(example.galleryItems);
  registerAll(example.galleryRelations);
  registerAll(example.items);
  registerAll(example.itemJourneys);
  registerAll(example.storySchemaFields);
  registerAll(example.attributeValues);
  registerAll(example.favorites);
  registerAll(example.locationRelations);

  const remapId = (id: string) => idMap.get(id) ?? id;
  const remapNullableId = (id: string | null) => id === null ? null : remapId(id);
  const cloneEntity = <T extends EntityWithId>(entity: T): T => ({ ...entity, id: remapId(entity.id) });
  const storyId = remapId(example.story.id);

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
    chapters: example.chapters.map(chapter => ({ ...cloneEntity(chapter), storyId })),
    scenes: example.scenes.map(scene => ({
      ...cloneEntity(scene), storyId, chapterId: remapId(scene.chapterId), locationId: remapId(scene.locationId),
    })),
    choices: example.choices.map(choice => ({
      ...cloneEntity(choice), storyId, sceneId: remapId(choice.sceneId), nextSceneId: remapId(choice.nextSceneId),
    })),
    choiceCheckGroups: example.choiceCheckGroups?.map(group => ({
      ...cloneEntity(group), storyId, choiceId: remapId(group.choiceId),
    })),
    choiceChecks: example.choiceChecks?.map(check => ({
      ...cloneEntity(check), storyId, groupId: remapId(check.groupId),
      sceneId: remapNullableId(check.sceneId), itemId: remapNullableId(check.itemId),
    })),
    effects: example.effects?.map(effect => ({
      ...cloneEntity(effect), storyId, entityId: remapId(effect.entityId), itemId: remapNullableId(effect.itemId),
    })),
    characters: example.characters.map(character => ({ ...cloneEntity(character), storyId })),
    locations: example.locations.map(location => ({ ...cloneEntity(location), storyId })),
    worldRules: example.worldRules.map(worldRule => ({ ...cloneEntity(worldRule), storyId })),
    notes: example.notes.map(note => ({ ...cloneEntity(note), storyId })),
    noteRelations: example.noteRelations.map(relation => ({
      ...cloneEntity(relation), storyId, noteId: remapId(relation.noteId), relationId: remapId(relation.relationId),
    })),
    tags: example.tags.map(tag => ({ ...cloneEntity(tag), storyId })),
    tagRelations: example.tagRelations.map(relation => ({
      ...cloneEntity(relation), storyId, tagId: remapId(relation.tagId), relationId: remapId(relation.relationId),
    })),
    suggestions: example.suggestions.map(suggestion => ({ ...cloneEntity(suggestion), storyId })),
    characterRelations: example.characterRelations.map(relation => ({
      ...cloneEntity(relation), storyId, character1Id: remapId(relation.character1Id), character2Id: remapId(relation.character2Id),
    })),
    characterScenes: example.characterScenes.map(relation => ({
      ...cloneEntity(relation), storyId, characterId: remapId(relation.characterId), sceneId: remapId(relation.sceneId),
    })),
    galleryItems: example.galleryItems.map(item => ({ ...cloneEntity(item), storyId })),
    galleryRelations: example.galleryRelations?.map(relation => ({
      ...cloneEntity(relation), storyId, galleryId: remapId(relation.galleryId), ownerId: remapId(relation.ownerId),
    })),
    items: example.items?.map(item => ({
      ...cloneEntity(item), storyId, characterOwnerId: remapNullableId(item.characterOwnerId),
    })),
    itemJourneys: example.itemJourneys.map(journey => ({
      ...cloneEntity(journey), storyId, itemId: remapId(journey.itemId), sceneId: remapId(journey.sceneId),
      newCharacterOwnerId: remapNullableId(journey.newCharacterOwnerId),
    })),
    storySchemaFields: example.storySchemaFields?.map(field => ({ ...cloneEntity(field), storyId })),
    attributeValues: example.attributeValues?.map(value => ({
      ...cloneEntity(value), storyId, entityId: remapId(value.entityId), fieldId: remapId(value.fieldId),
    })),
    favorites: example.favorites?.map(favorite => ({
      ...cloneEntity(favorite), storyId, entityId: remapId(favorite.entityId), userId,
    })),
    locationRelations: example.locationRelations?.map(relation => ({
      ...cloneEntity(relation), storyId, locationAId: remapId(relation.locationAId), locationBId: remapId(relation.locationBId),
    })),
    // O cursor pertence ao servidor de origem, não à cópia recém-instalada.
    serverLastOperationVersion: 0,
  };

  // Mantém esta função segura caso um exemplo novo introduza um vínculo inválido.
  return FullStoryExportSchema.parse(cloned);
}
