import {
  AttributeType,
  decodeAttributeValue,
  OperationLogEntityType,
  StorySchemaEntityType,
} from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { TFunction } from 'i18next';
import { AppDrizzleClient } from '../db';
import {
  attributeValues,
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
  locations,
  locationRelations,
  noteRelations,
  notes,
  operationLogs,
  scenes,
  seeAlsoRelations,
  suggestions,
  stories,
  storySchemaFields,
  tagRelations,
  tags,
  users,
  worldRules,
} from '../db/schemas';

/** Chave de tradução singular já usada neste arquivo para cada tipo de entidade que pode
 *  receber Story Schema - reaproveitada em vez de uma segunda lista de rótulos. */
const STORY_SCHEMA_ENTITY_TYPE_SINGULAR_KEYS: Record<StorySchemaEntityType, string> = {
  Character: 'character',
  Location: 'location',
  Item: 'item',
  Scene: 'scene',
  Chapter: 'chapter',
  Note: 'note',
  WorldRule: 'world_rule',
};

const ENTITY_LOOKUP_MAP: Record<string, OperationLogEntityType> = {
  chapter: OperationLogEntityType.Chapter,
  character: OperationLogEntityType.Character,
  choice: OperationLogEntityType.Choice,
  item: OperationLogEntityType.Item,
  itemjourney: OperationLogEntityType.ItemJourney,
  location: OperationLogEntityType.Location,
  note: OperationLogEntityType.Note,
  operationlog: OperationLogEntityType.OperationLog,
  scene: OperationLogEntityType.Scene,
  story: OperationLogEntityType.Story,
  tag: OperationLogEntityType.Tag,
  user: OperationLogEntityType.User,
  worldrule: OperationLogEntityType.WorldRule,
  characterrelation: OperationLogEntityType.CharacterRelation,
  locationrelation: OperationLogEntityType.LocationRelation,
  noterelation: OperationLogEntityType.NoteRelation,
  tagrelation: OperationLogEntityType.TagRelation,
  characterscene: OperationLogEntityType.CharacterScene,
  gallery: OperationLogEntityType.Gallery,
  galleryrelation: OperationLogEntityType.GalleryRelation,
  favorite: OperationLogEntityType.Favorite,
  seealsorelation: OperationLogEntityType.SeeAlsoRelation,
  comment: OperationLogEntityType.Comment,
  choicecheckgroup: OperationLogEntityType.ChoiceCheckGroup,
  choicecheck: OperationLogEntityType.ChoiceCheck,
  effect: OperationLogEntityType.Effect,
};

/** Chaves de tradução do rótulo de cada tipo de Effect - usadas para montar o nome legível
 *  de um Effect a partir do seu effectType (entidade sem nome próprio). */
const EFFECT_TYPE_LABEL_KEYS: Record<string, string> = {
  itemGrant: 'effect_item_grant',
  itemTake: 'effect_item_take',
  triggerSet: 'effect_trigger_set',
  triggerUnset: 'effect_trigger_unset',
};

export class EntityService {
  static async getEntityName(
    db: AppDrizzleClient,
    entityType: OperationLogEntityType,
    entityId: string,
    storyId: string,
    t: TFunction,
  ): Promise<string | undefined> {
    let translatedEntityType: string | undefined;
    let entitySpecificName: string | undefined;

    switch (entityType) {
      case OperationLogEntityType.Story:
        const story = await db.query.stories.findFirst({
          where: and(eq(stories.id, entityId), eq(stories.isDeleted, false)),
          columns: { title: true },
        });
        entitySpecificName = story?.title;
        translatedEntityType = t('story');
        break;
      case OperationLogEntityType.Character:
        const character = await db.query.characters.findFirst({
          where: and(eq(characters.id, entityId), eq(characters.isDeleted, false)),
          columns: { name: true },
        });
        entitySpecificName = character?.name;
        translatedEntityType = t('character');
        break;
      case OperationLogEntityType.Note:
        const note = await db.query.notes.findFirst({
          where: and(eq(notes.id, entityId), eq(notes.isDeleted, false)),
          columns: { title: true },
        });
        entitySpecificName = note?.title;
        translatedEntityType = t('note');
        break;
      case OperationLogEntityType.Location:
        const location = await db.query.locations.findFirst({
          where: and(eq(locations.id, entityId), eq(locations.isDeleted, false)),
          columns: { name: true },
        });
        entitySpecificName = location?.name;
        translatedEntityType = t('location');
        break;
      case OperationLogEntityType.WorldRule:
        const worldRule = await db.query.worldRules.findFirst({
          where: and(eq(worldRules.id, entityId), eq(worldRules.isDeleted, false)),
          columns: { title: true },
        });
        entitySpecificName = worldRule?.title;
        translatedEntityType = t('world_rule');
        break;
      case OperationLogEntityType.Tag:
        const tag = await db.query.tags.findFirst({
          where: and(eq(tags.id, entityId), eq(tags.isDeleted, false)),
          columns: { name: true },
        });
        entitySpecificName = tag?.name;
        translatedEntityType = t('tag');
        break;
      case OperationLogEntityType.User:
        const user = await db.query.users.findFirst({
          where: and(eq(users.idUser, entityId), eq(users.isDeleted, false)),
          columns: { displayName: true },
        });
        entitySpecificName = user?.displayName ?? undefined;
        translatedEntityType = t('user');
        break;
      case OperationLogEntityType.Chapter:
        const chapter = await db.query.chapters.findFirst({
          where: and(eq(chapters.id, entityId), eq(chapters.isDeleted, false)),
          columns: { name: true },
        });
        entitySpecificName = chapter?.name;
        translatedEntityType = t('chapter');
        break;
      case OperationLogEntityType.Scene:
        const scene = await db.query.scenes.findFirst({
          where: and(eq(scenes.id, entityId), eq(scenes.isDeleted, false)),
          columns: { name: true },
        });
        entitySpecificName = scene?.name;
        translatedEntityType = t('scene');
        break;
      case OperationLogEntityType.Choice:
        const choice = await db.query.choices.findFirst({
          where: and(eq(choices.id, entityId), eq(choices.isDeleted, false)),
          columns: { sceneId: true, text: true },
        });
        if (choice) {
          const originScene = await db.query.scenes.findFirst({
            where: and(eq(scenes.id, choice.sceneId), eq(scenes.isDeleted, false)),
            columns: { name: true },
          });
          entitySpecificName = `${t('from_scene')}: ${originScene?.name || t('unknown_scene')} - ${choice.text}`;
        } else {
          entitySpecificName = `${t('unknown_choice')} ${t('id')}: ${entityId}`;
        }
        translatedEntityType = t('choice');
        break;
      case OperationLogEntityType.Gallery:
        const gallery = await db.query.galleries.findFirst({
          where: and(eq(galleries.id, entityId), eq(galleries.isDeleted, false)),
          columns: { title: true, fileName: true },
        });
        entitySpecificName = gallery?.title || gallery?.fileName;
        translatedEntityType = t('gallery');
        break;
      case OperationLogEntityType.Suggestion:
        const suggestion = await db.query.suggestions.findFirst({
          where: and(eq(suggestions.id, entityId), eq(suggestions.storyId, storyId)),
          columns: { value: true },
        });
        entitySpecificName = suggestion?.value;
        translatedEntityType = t('suggestion');
        break;
      case OperationLogEntityType.Favorite:
        const favorite = await db.query.favorites.findFirst({
          where: and(eq(favorites.id, entityId), eq(favorites.storyId, storyId)),
          columns: { entityId: true, entityType: true },
        });
        if (favorite) {
          entitySpecificName = await EntityService.getEntityName(
            db,
            favorite.entityType as OperationLogEntityType,
            favorite.entityId,
            storyId,
            t,
          );
        }
        translatedEntityType = t('favorite');
        break;
      case OperationLogEntityType.GalleryRelation:
        const galleryRelation = await db.query.galleryRelations.findFirst({
          where: and(
            eq(galleryRelations.id, entityId),
            eq(galleryRelations.storyId, storyId),
            eq(galleryRelations.isDeleted, false),
          ),
          columns: { galleryId: true, ownerId: true, ownerType: true },
        });

        if (galleryRelation) {
          const relatedGallery = await db.query.galleries.findFirst({
            where: and(eq(galleries.id, galleryRelation.galleryId), eq(galleries.isDeleted, false)),
            columns: { title: true, fileName: true },
          });
          const relatedOwner = await EntityService._resolveRelationEntityName(
            db,
            galleryRelation.ownerType as OperationLogEntityType,
            galleryRelation.ownerId,
            storyId,
            t,
          );
          entitySpecificName = t('gallery_attributed_to_entity', {
            medianame: relatedGallery?.title || relatedGallery?.fileName || t('unknown_gallery'),
            entityname: relatedOwner.name || t('unknown_entity'),
            entitytype: relatedOwner.type || t('unknown_entity_type'),
          });
        }
        translatedEntityType = t('gallery_relation');
        break;
      case OperationLogEntityType.Item:
        const item = await db.query.items.findFirst({
          where: and(eq(items.id, entityId), eq(items.isDeleted, false)),
          columns: { name: true },
        });
        entitySpecificName = item?.name;
        translatedEntityType = t('item');
        break;
      case OperationLogEntityType.ItemJourney:
        const itemJourney = await db.query.itemJourneys.findFirst({
          where: and(eq(itemJourneys.id, entityId), eq(itemJourneys.isDeleted, false)),
          columns: { itemId: true, sceneId: true },
        });
        if (itemJourney) {
          const relatedItem = await db.query.items.findFirst({
            where: and(eq(items.id, itemJourney.itemId), eq(items.isDeleted, false)),
            columns: { name: true },
          });
          const targetScene = await db.query.scenes.findFirst({
            where: and(eq(scenes.id, itemJourney.sceneId), eq(scenes.isDeleted, false)),
            columns: { name: true },
          });
          entitySpecificName = `${relatedItem?.name || t('unknown_item')} ${t('showed_in_scene')} ${targetScene?.name || t('unknown_scene')}`;
        }
        translatedEntityType = t('item_journey');
        break;
      case OperationLogEntityType.CharacterRelation:
        const charRelation = await db.query.characterRelations.findFirst({
          where: and(eq(characterRelations.id, entityId), eq(characterRelations.isDeleted, false)),
          columns: { character1Id: true, character2Id: true },
        });

        if (charRelation) {
          const char1 = await db.query.characters.findFirst({
            where: and(
              eq(characters.id, charRelation.character1Id),
              eq(characters.isDeleted, false),
            ),
            columns: { name: true },
          });
          const char2 = await db.query.characters.findFirst({
            where: and(
              eq(characters.id, charRelation.character2Id),
              eq(characters.isDeleted, false),
            ),
            columns: { name: true },
          });
          entitySpecificName = `${char1?.name || t('unknown_character')} - ${char2?.name || t('unknown_character')} ${t('relation')}`;
        }
        translatedEntityType = t('character_relation');
        break;
      case OperationLogEntityType.LocationRelation:
        const locationRelation = await db.query.locationRelations.findFirst({
          where: and(
            eq(locationRelations.id, entityId),
            eq(locationRelations.storyId, storyId),
            eq(locationRelations.isDeleted, false),
          ),
          columns: { locationAId: true, locationBId: true, relationType: true },
        });

        if (locationRelation) {
          const locationA = await db.query.locations.findFirst({
            where: and(
              eq(locations.id, locationRelation.locationAId),
              eq(locations.isDeleted, false),
            ),
            columns: { name: true },
          });
          const locationB = await db.query.locations.findFirst({
            where: and(
              eq(locations.id, locationRelation.locationBId),
              eq(locations.isDeleted, false),
            ),
            columns: { name: true },
          });
          const nameA = locationA?.name || t('unknown_location');
          const nameB = locationB?.name || t('unknown_location');
          entitySpecificName =
            locationRelation.relationType === 'contains'
              ? t('location_contains_location', { parentName: nameA, childName: nameB })
              : t('location_connected_to_location', { locationAName: nameA, locationBName: nameB });
        }
        translatedEntityType = t('location_relation');
        break;
      case OperationLogEntityType.TagRelation:
        const tagRel = await db.query.tagRelations.findFirst({
          where: and(
            eq(tagRelations.id, entityId),
            eq(tagRelations.storyId, storyId),
            eq(tagRelations.isDeleted, false),
          ),
          columns: { tagId: true, relationId: true, relationType: true },
        });

        if (tagRel) {
          const tag = await db.query.tags.findFirst({
            where: and(
              eq(tags.id, tagRel.tagId),
              eq(tags.storyId, storyId),
              eq(tags.isDeleted, false),
            ),
            columns: { name: true },
          });
          const related = await EntityService._resolveRelationEntityName(
            db,
            tagRel.relationType as OperationLogEntityType,
            tagRel.relationId,
            storyId,
            t,
          );
          // Correctly pass string values for entityname and entitytype to the translation function
          entitySpecificName = t('tag_attributed_to_entity', {
            tagname: tag?.name || t('unknown_tag'),
            entityname: related.name || t('unknown_entity'),
            entitytype: related.type || t('unknown_entity_type'),
          });
        }
        translatedEntityType = t('tag_relation'); // Assuming 'tag_relation' is a translation key
        break;
      case OperationLogEntityType.NoteRelation:
        const noteRel = await db.query.noteRelations.findFirst({
          where: and(
            eq(noteRelations.id, entityId),
            eq(noteRelations.storyId, storyId),
            eq(noteRelations.isDeleted, false),
          ),
          columns: { noteId: true, relationId: true, relationType: true },
        });

        if (noteRel) {
          const note = await db.query.notes.findFirst({
            where: and(
              eq(notes.id, noteRel.noteId),
              eq(notes.storyId, storyId),
              eq(notes.isDeleted, false),
            ),
            columns: { title: true },
          });
          const related = await EntityService._resolveRelationEntityName(
            db,
            noteRel.relationType as OperationLogEntityType,
            noteRel.relationId,
            storyId,
            t,
          );
          entitySpecificName = t('note_attributed_to_entity', {
            notename: note?.title || t('unknown_note'),
            entityname: related.name || t('unknown_entity'),
            entitytype: related.type || t('unknown_entity_type'),
          });
        }
        translatedEntityType = t('note_relation');
        break;
      case OperationLogEntityType.OperationLog:
        const opLog = await db.query.operationLogs.findFirst({
          where: eq(operationLogs.id, entityId),
          columns: { id: true },
        });
        entitySpecificName = `${t('operation_logs_title')} ${t('id')}: ${opLog?.id || entityId}`; // Use t() for title and ID
        translatedEntityType = t('operation_log');
        break;
      case OperationLogEntityType.CharacterScene:
        const characterScene = await db.query.characterScenes.findFirst({
          where: and(eq(characterScenes.id, entityId), eq(characterScenes.isDeleted, false)),
          columns: { characterId: true, sceneId: true },
        });

        if (characterScene) {
          const character = await db.query.characters.findFirst({
            where: and(
              eq(characters.id, characterScene.characterId),
              eq(characters.isDeleted, false),
            ),
            columns: { name: true },
          });
          const scene = await db.query.scenes.findFirst({
            where: and(eq(scenes.id, characterScene.sceneId), eq(scenes.isDeleted, false)),
            columns: { name: true },
          });
          entitySpecificName = t('character_attributed_to_scene', {
            characterName: character?.name || t('unknown_character'),
            sceneName: scene?.name || t('unknown_scene'),
          });
        }
        translatedEntityType = t('character_scene_relation');
        break;
      case OperationLogEntityType.StorySchemaField:
        const schemaField = await db.query.storySchemaFields.findFirst({
          where: and(eq(storySchemaFields.id, entityId), eq(storySchemaFields.storyId, storyId)),
          columns: { name: true, entityType: true },
        });
        if (schemaField) {
          const entityTypeLabelKey =
            STORY_SCHEMA_ENTITY_TYPE_SINGULAR_KEYS[schemaField.entityType as StorySchemaEntityType];
          entitySpecificName = `${schemaField.name} (${entityTypeLabelKey ? t(entityTypeLabelKey) : schemaField.entityType})`;
        }
        translatedEntityType = t('custom_attribute');
        break;
      case OperationLogEntityType.AttributeValue:
        const attributeValue = await db.query.attributeValues.findFirst({
          where: and(eq(attributeValues.id, entityId), eq(attributeValues.storyId, storyId)),
          columns: { fieldId: true, entityId: true, entityType: true, value: true },
        });
        if (attributeValue) {
          const field = await db.query.storySchemaFields.findFirst({
            where: eq(storySchemaFields.id, attributeValue.fieldId),
            columns: { name: true, type: true, targetEntityType: true },
          });
          const owner = await EntityService._resolveRelationEntityName(
            db,
            attributeValue.entityType as OperationLogEntityType,
            attributeValue.entityId,
            storyId,
            t,
          );
          const decodedValue = field
            ? decodeAttributeValue(field.type as AttributeType, attributeValue.value)
            : attributeValue.value;
          const entityReferenceName =
            field?.type === AttributeType.ENTITY &&
            field.targetEntityType &&
            typeof decodedValue === 'string'
              ? await EntityService.getEntityIdentifier(
                  db,
                  field.targetEntityType,
                  decodedValue,
                  storyId,
                  t,
                )
              : undefined;
          entitySpecificName = t('attribute_value_attributed_to_entity', {
            fieldname: field?.name || t('unknown_attribute'),
            value:
              decodedValue === null || decodedValue === undefined
                ? t('common_na')
                : entityReferenceName || String(decodedValue),
            entityname: owner.name || t('unknown_entity'),
            entitytype: owner.type || t('unknown_entity_type'),
          });
        }
        translatedEntityType = t('custom_attribute_value');
        break;
      case OperationLogEntityType.SeeAlsoRelation:
        const seeAlsoRelation = await db.query.seeAlsoRelations.findFirst({
          where: and(
            eq(seeAlsoRelations.id, entityId),
            eq(seeAlsoRelations.storyId, storyId),
            eq(seeAlsoRelations.isDeleted, false),
          ),
          columns: { entityAType: true, entityAId: true, entityBType: true, entityBId: true },
        });
        if (seeAlsoRelation) {
          const sideA = await EntityService._resolveRelationEntityName(
            db,
            seeAlsoRelation.entityAType as OperationLogEntityType,
            seeAlsoRelation.entityAId,
            storyId,
            t,
          );
          const sideB = await EntityService._resolveRelationEntityName(
            db,
            seeAlsoRelation.entityBType as OperationLogEntityType,
            seeAlsoRelation.entityBId,
            storyId,
            t,
          );
          entitySpecificName = `${sideA.name || t('unknown_entity')} (${sideA.type || t('unknown_entity_type')}) - ${sideB.name || t('unknown_entity')} (${sideB.type || t('unknown_entity_type')})`;
        }
        translatedEntityType = t('see_also_relation');
        break;
      case OperationLogEntityType.Comment:
        const comment = await db.query.comments.findFirst({
          where: and(
            eq(comments.id, entityId),
            eq(comments.storyId, storyId),
            eq(comments.isDeleted, false),
          ),
          columns: {
            entityType: true,
            entityId: true,
            fieldId: true,
            fieldKey: true,
            commentText: true,
          },
        });
        if (comment) {
          const target = await EntityService._resolveRelationEntityName(
            db,
            comment.entityType as OperationLogEntityType,
            comment.entityId,
            storyId,
            t,
          );
          let fieldLabel = comment.fieldKey || '';
          if (comment.fieldId) {
            const field = await db.query.storySchemaFields.findFirst({
              where: eq(storySchemaFields.id, comment.fieldId),
              columns: { name: true },
            });
            fieldLabel = field?.name || fieldLabel;
          }
          const snippet =
            comment.commentText.length > 60
              ? `${comment.commentText.slice(0, 60)}...`
              : comment.commentText;
          entitySpecificName = `${target.name || t('unknown_entity')} (${target.type || t('unknown_entity_type')}) - ${fieldLabel}: "${snippet}"`;
        }
        translatedEntityType = t('comment');
        break;
      case OperationLogEntityType.ChoiceCheckGroup:
        const choiceCheckGroup = await db.query.choiceCheckGroups.findFirst({
          where: and(eq(choiceCheckGroups.id, entityId), eq(choiceCheckGroups.isDeleted, false)),
          columns: { choiceId: true },
        });
        if (choiceCheckGroup) {
          const groupChoice = await db.query.choices.findFirst({
            where: and(eq(choices.id, choiceCheckGroup.choiceId), eq(choices.isDeleted, false)),
            columns: { text: true },
          });
          entitySpecificName = groupChoice?.text || t('unknown_choice');
        }
        translatedEntityType = t('choice_check_group');
        break;
      case OperationLogEntityType.ChoiceCheck:
        const choiceCheck = await db.query.choiceChecks.findFirst({
          where: and(eq(choiceChecks.id, entityId), eq(choiceChecks.isDeleted, false)),
          columns: { groupId: true },
        });
        if (choiceCheck) {
          const checkGroup = await db.query.choiceCheckGroups.findFirst({
            where: and(
              eq(choiceCheckGroups.id, choiceCheck.groupId),
              eq(choiceCheckGroups.isDeleted, false),
            ),
            columns: { choiceId: true },
          });
          const checkChoice = checkGroup
            ? await db.query.choices.findFirst({
                where: and(eq(choices.id, checkGroup.choiceId), eq(choices.isDeleted, false)),
                columns: { text: true },
              })
            : undefined;
          entitySpecificName = checkChoice?.text || t('unknown_choice');
        }
        translatedEntityType = t('choice_check');
        break;
      case OperationLogEntityType.Effect:
        const effect = await db.query.effects.findFirst({
          where: and(eq(effects.id, entityId), eq(effects.isDeleted, false)),
          columns: { effectType: true, itemId: true, triggerName: true },
        });
        if (effect) {
          const effectLabel = t(EFFECT_TYPE_LABEL_KEYS[effect.effectType] || effect.effectType);
          let target: string | undefined;
          if (effect.effectType === 'itemGrant' || effect.effectType === 'itemTake') {
            const effectItem = effect.itemId
              ? await db.query.items.findFirst({
                  where: and(eq(items.id, effect.itemId), eq(items.isDeleted, false)),
                  columns: { name: true },
                })
              : undefined;
            target = effectItem?.name || t('unknown_item');
          } else {
            target = effect.triggerName || t('unknown_trigger');
          }
          entitySpecificName = `${effectLabel}: ${target}`;
        }
        translatedEntityType = t('effect');
        break;
    }
    if (entitySpecificName) {
      return `${translatedEntityType} - ${entitySpecificName}`;
    } else {
      // If no specific name found, but entityType is known, return just the translated type
      return translatedEntityType;
    }
  }

  // Private helper to resolve the name and type of a related entity (e.g., from TagRelation)
  private static async _resolveRelationEntityName(
    db: AppDrizzleClient,
    relationType: OperationLogEntityType,
    relationId: string,
    storyId: string,
    t: TFunction,
  ): Promise<{ name: string | undefined; type: string | undefined }> {
    let name: string | undefined;
    let type: string | undefined;

    switch (relationType) {
      case OperationLogEntityType.Story:
        const story = await db.query.stories.findFirst({
          where: and(
            eq(stories.id, relationId),
            eq(stories.id, storyId),
            eq(stories.isDeleted, false),
          ),
          columns: { title: true },
        });
        name = story?.title;
        type = t('story');
        break;
      case OperationLogEntityType.Character:
        const character = await db.query.characters.findFirst({
          where: and(
            eq(characters.id, relationId),
            eq(characters.storyId, storyId),
            eq(characters.isDeleted, false),
          ),
          columns: { name: true },
        });
        name = character?.name;
        type = t('character');
        break;
      case OperationLogEntityType.Note:
        const note = await db.query.notes.findFirst({
          where: and(
            eq(notes.id, relationId),
            eq(notes.storyId, storyId),
            eq(notes.isDeleted, false),
          ),
          columns: { title: true },
        });
        name = note?.title;
        type = t('note');
        break;
      case OperationLogEntityType.Location:
        const location = await db.query.locations.findFirst({
          where: and(
            eq(locations.id, relationId),
            eq(locations.storyId, storyId),
            eq(locations.isDeleted, false),
          ),
          columns: { name: true },
        });
        name = location?.name;
        type = t('location');
        break;
      case OperationLogEntityType.WorldRule:
        const worldRule = await db.query.worldRules.findFirst({
          where: and(
            eq(worldRules.id, relationId),
            eq(worldRules.storyId, storyId),
            eq(worldRules.isDeleted, false),
          ),
          columns: { title: true },
        });
        name = worldRule?.title;
        type = t('world_rule');
        break;
      case OperationLogEntityType.Chapter:
        const chapter = await db.query.chapters.findFirst({
          where: and(
            eq(chapters.id, relationId),
            eq(chapters.storyId, storyId),
            eq(chapters.isDeleted, false),
          ),
          columns: { name: true },
        });
        name = chapter?.name;
        type = t('chapter');
        break;
      case OperationLogEntityType.Scene:
        const scene = await db.query.scenes.findFirst({
          where: and(
            eq(scenes.id, relationId),
            eq(scenes.storyId, storyId),
            eq(scenes.isDeleted, false),
          ),
          columns: { name: true },
        });
        name = scene?.name;
        type = t('scene');
        break;
      case OperationLogEntityType.Item:
        const item = await db.query.items.findFirst({
          where: and(
            eq(items.id, relationId),
            eq(items.storyId, storyId),
            eq(items.isDeleted, false),
          ),
          columns: { name: true },
        });
        name = item?.name;
        type = t('item');
        break;
      case OperationLogEntityType.Choice:
        const relatedChoice = await db.query.choices.findFirst({
          where: and(
            eq(choices.id, relationId),
            eq(choices.storyId, storyId),
            eq(choices.isDeleted, false),
          ),
          columns: { text: true },
        });
        name = relatedChoice?.text;
        type = t('choice');
        break;
      case OperationLogEntityType.Tag:
        const relatedTag = await db.query.tags.findFirst({
          where: and(eq(tags.id, relationId), eq(tags.storyId, storyId), eq(tags.isDeleted, false)),
          columns: { name: true },
        });
        name = relatedTag?.name;
        type = t('tag');
        break;
      case OperationLogEntityType.Gallery:
        const gallery = await db.query.galleries.findFirst({
          where: and(
            eq(galleries.id, relationId),
            eq(galleries.storyId, storyId),
            eq(galleries.isDeleted, false),
          ),
          columns: { title: true, fileName: true },
        });
        name = gallery?.title || gallery?.fileName;
        type = t('gallery');
        break;
      case OperationLogEntityType.ItemJourney:
        const itemJourney = await db.query.itemJourneys.findFirst({
          where: and(
            eq(itemJourneys.id, relationId),
            eq(itemJourneys.storyId, storyId),
            eq(itemJourneys.isDeleted, false),
          ),
          columns: { itemId: true, sceneId: true },
        });
        if (itemJourney) {
          const relatedItem = await db.query.items.findFirst({
            where: and(eq(items.id, itemJourney.itemId), eq(items.isDeleted, false)),
            columns: { name: true },
          });
          const targetScene = await db.query.scenes.findFirst({
            where: and(eq(scenes.id, itemJourney.sceneId), eq(scenes.isDeleted, false)),
            columns: { name: true },
          });
          name = `${relatedItem?.name || t('unknown_item')} ${t('showed_in_scene')} ${targetScene?.name || t('unknown_scene')}`;
        }
        type = t('item_journey');
        break;
      case OperationLogEntityType.NoteRelation:
        const noteRelation = await db.query.noteRelations.findFirst({
          where: and(
            eq(noteRelations.id, relationId),
            eq(noteRelations.storyId, storyId),
            eq(noteRelations.isDeleted, false),
          ),
          columns: { noteId: true, relationId: true, relationType: true },
        });
        if (noteRelation) {
          const note = await db.query.notes.findFirst({
            where: and(
              eq(notes.id, noteRelation.noteId),
              eq(notes.storyId, storyId),
              eq(notes.isDeleted, false),
            ),
            columns: { title: true },
          });
          const relatedEntity = await EntityService._resolveRelationEntityName(
            db,
            noteRelation.relationType as OperationLogEntityType,
            noteRelation.relationId,
            storyId,
            t,
          );
          name = t('note_attributed_to_entity_short', {
            notename: note?.title || t('unknown_note'),
            entityname: relatedEntity.name || t('unknown_entity'),
            entitytype: relatedEntity.type || t('unknown_entity_type'),
          });
          type = t('note_relation');
        }
        break;
      case OperationLogEntityType.CharacterRelation:
        const characterRelation = await db.query.characterRelations.findFirst({
          where: and(
            eq(characterRelations.id, relationId),
            eq(characterRelations.isDeleted, false),
          ),
          columns: { character1Id: true, character2Id: true },
        });
        if (characterRelation) {
          const char1 = await db.query.characters.findFirst({
            where: and(
              eq(characters.id, characterRelation.character1Id),
              eq(characters.isDeleted, false),
            ),
            columns: { name: true },
          });
          const char2 = await db.query.characters.findFirst({
            where: and(
              eq(characters.id, characterRelation.character2Id),
              eq(characters.isDeleted, false),
            ),
            columns: { name: true },
          });
          name = `${char1?.name || t('unknown_character')} - ${char2?.name || t('unknown_character')} ${t('relation')}`;
        }
        type = t('character_relation');
        break;
      case OperationLogEntityType.LocationRelation:
        const locationRelation = await db.query.locationRelations.findFirst({
          where: and(
            eq(locationRelations.id, relationId),
            eq(locationRelations.storyId, storyId),
            eq(locationRelations.isDeleted, false),
          ),
          columns: { locationAId: true, locationBId: true, relationType: true },
        });
        if (locationRelation) {
          const locationA = await db.query.locations.findFirst({
            where: and(
              eq(locations.id, locationRelation.locationAId),
              eq(locations.isDeleted, false),
            ),
            columns: { name: true },
          });
          const locationB = await db.query.locations.findFirst({
            where: and(
              eq(locations.id, locationRelation.locationBId),
              eq(locations.isDeleted, false),
            ),
            columns: { name: true },
          });
          const nameA = locationA?.name || t('unknown_location');
          const nameB = locationB?.name || t('unknown_location');
          name =
            locationRelation.relationType === 'contains'
              ? t('location_contains_location', { parentName: nameA, childName: nameB })
              : t('location_connected_to_location', { locationAName: nameA, locationBName: nameB });
        }
        type = t('location_relation');
        break;
      case OperationLogEntityType.TagRelation:
        const tagRelationForIdentifier = await db.query.tagRelations.findFirst({
          where: and(
            eq(tagRelations.id, relationId),
            eq(tagRelations.storyId, storyId),
            eq(tagRelations.isDeleted, false),
          ),
          columns: { tagId: true, relationId: true, relationType: true },
        });
        if (tagRelationForIdentifier) {
          const relatedTagForIdentifier = await db.query.tags.findFirst({
            where: and(
              eq(tags.id, tagRelationForIdentifier.tagId),
              eq(tags.storyId, storyId),
              eq(tags.isDeleted, false),
            ),
            columns: { name: true },
          });
          const relatedForTag = await EntityService._resolveRelationEntityName(
            db,
            tagRelationForIdentifier.relationType as OperationLogEntityType,
            tagRelationForIdentifier.relationId,
            storyId,
            t,
          );
          name = t('tag_attributed_to_entity', {
            tagname: relatedTagForIdentifier?.name || t('unknown_tag'),
            entityname: relatedForTag.name || t('unknown_entity'),
            entitytype: relatedForTag.type || t('unknown_entity_type'),
          });
        }
        type = t('tag_relation');
        break;
      case OperationLogEntityType.CharacterScene:
        const characterScene = await db.query.characterScenes.findFirst({
          where: and(eq(characterScenes.id, relationId), eq(characterScenes.isDeleted, false)),
          columns: { characterId: true, sceneId: true },
        });
        if (characterScene) {
          const relatedCharacter = await db.query.characters.findFirst({
            where: and(
              eq(characters.id, characterScene.characterId),
              eq(characters.isDeleted, false),
            ),
            columns: { name: true },
          });
          const relatedScene = await db.query.scenes.findFirst({
            where: and(eq(scenes.id, characterScene.sceneId), eq(scenes.isDeleted, false)),
            columns: { name: true },
          });
          name = t('character_attributed_to_scene', {
            characterName: relatedCharacter?.name || t('unknown_character'),
            sceneName: relatedScene?.name || t('unknown_scene'),
          });
        }
        type = t('character_scene_relation');
        break;
      case OperationLogEntityType.GalleryRelation:
        const galleryRelation = await db.query.galleryRelations.findFirst({
          where: and(
            eq(galleryRelations.id, relationId),
            eq(galleryRelations.storyId, storyId),
            eq(galleryRelations.isDeleted, false),
          ),
          columns: { galleryId: true, ownerId: true, ownerType: true },
        });
        if (galleryRelation) {
          const relatedGalleryForIdentifier = await db.query.galleries.findFirst({
            where: and(eq(galleries.id, galleryRelation.galleryId), eq(galleries.isDeleted, false)),
            columns: { title: true, fileName: true },
          });
          const relatedOwnerForGallery = await EntityService._resolveRelationEntityName(
            db,
            galleryRelation.ownerType as OperationLogEntityType,
            galleryRelation.ownerId,
            storyId,
            t,
          );
          name = t('gallery_attributed_to_entity', {
            medianame:
              relatedGalleryForIdentifier?.title ||
              relatedGalleryForIdentifier?.fileName ||
              t('unknown_gallery'),
            entityname: relatedOwnerForGallery.name || t('unknown_entity'),
            entitytype: relatedOwnerForGallery.type || t('unknown_entity_type'),
          });
        }
        type = t('gallery_relation');
        break;
      case OperationLogEntityType.SeeAlsoRelation:
        const seeAlsoRelation = await db.query.seeAlsoRelations.findFirst({
          where: and(
            eq(seeAlsoRelations.id, relationId),
            eq(seeAlsoRelations.storyId, storyId),
            eq(seeAlsoRelations.isDeleted, false),
          ),
          columns: { entityAType: true, entityAId: true, entityBType: true, entityBId: true },
        });
        if (seeAlsoRelation) {
          const sideA = await EntityService._resolveRelationEntityName(
            db,
            seeAlsoRelation.entityAType as OperationLogEntityType,
            seeAlsoRelation.entityAId,
            storyId,
            t,
          );
          const sideB = await EntityService._resolveRelationEntityName(
            db,
            seeAlsoRelation.entityBType as OperationLogEntityType,
            seeAlsoRelation.entityBId,
            storyId,
            t,
          );
          name = `${sideA.name || t('unknown_entity')} (${sideA.type || t('unknown_entity_type')}) - ${sideB.name || t('unknown_entity')} (${sideB.type || t('unknown_entity_type')})`;
        }
        type = t('see_also_relation');
        break;
      default:
        name = undefined;
        type = t('unknown_entity_type');
    }
    return { name, type };
  }

  static async getEntityIdentifier(
    db: AppDrizzleClient,
    entityTypeString: string,
    entityId: string,
    storyId: string,
    t: TFunction,
  ): Promise<string | undefined> {
    const operationLogEntityType = ENTITY_LOOKUP_MAP[entityTypeString.toLowerCase()];

    if (operationLogEntityType === undefined) {
      throw new Error(`Invalid entityTypeString: ${entityTypeString}`);
    }

    const { name } = await EntityService._resolveRelationEntityName(
      db,
      operationLogEntityType,
      entityId,
      storyId,
      t,
    );
    return name;
  }
}
