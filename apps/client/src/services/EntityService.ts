import type { StorySchemaEntityType } from '@keres/shared';
import {
  AttributeType,
  decodeAttributeValue,
  OperationLogEntityType,
  suggestionDisplayValue,
} from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import type { TFunction } from 'i18next';
import type { AppDrizzleClient } from '../db';
import {
  attributeValues,
  boards,
  chapters,
  characterRelations,
  characters,
  characterScenes,
  choices,
  favorites,
  galleries,
  galleryRelations,
  itemJourneys,
  items,
  locations,
  locationMaps,
  locationRelations,
  noteRelations,
  notes,
  operationLogs,
  plots,
  plotScenes,
  scenes,
  suggestions,
  stories,
  storySchemaFields,
  tagRelations,
  tags,
  users,
  worldRules,
} from '../db/schemas';
import { getEntityIdentifier, resolveRelationEntityName } from './EntityIdentifierResolver';
import { resolveAdvancedEntityName } from './EntityAdvancedNameResolver';

/**
 * The singular translation key already used in this file for each entity type that can receive a Story
 * Schema - reused instead of a second list of labels.
 */
const STORY_SCHEMA_ENTITY_TYPE_SINGULAR_KEYS: Record<StorySchemaEntityType, string> = {
  Character: 'character',
  Location: 'location',
  Item: 'item',
  Scene: 'scene',
  Chapter: 'chapter',
  Note: 'note',
  WorldRule: 'world_rule',
};

/**
 * The translation keys for each Effect type's label - used to build an Effect's readable name from its
 * effectType (an entity with no name of its own).
 */

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
      case OperationLogEntityType.Board:
        const board = await db.query.boards.findFirst({
          where: and(
            eq(boards.id, entityId),
            eq(boards.storyId, storyId),
            eq(boards.isDeleted, false),
          ),
          columns: { name: true },
        });
        entitySpecificName = board?.name;
        translatedEntityType = t('board');
        break;
      case OperationLogEntityType.LocationMap:
        const locationMap = await db.query.locationMaps.findFirst({
          where: and(
            eq(locationMaps.id, entityId),
            eq(locationMaps.storyId, storyId),
            eq(locationMaps.isDeleted, false),
          ),
          columns: { name: true },
        });
        entitySpecificName = locationMap?.name;
        translatedEntityType = t('location_map');
        break;
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
        entitySpecificName = suggestionDisplayValue(suggestion?.value) ?? undefined;
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
          const relatedOwner = await resolveRelationEntityName(
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
          const related = await resolveRelationEntityName(
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
          const related = await resolveRelationEntityName(
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
      case OperationLogEntityType.Plot:
        const plot = await db.query.plots.findFirst({
          where: and(eq(plots.id, entityId), eq(plots.isDeleted, false)),
          columns: { name: true },
        });
        entitySpecificName = plot?.name || entityId;
        translatedEntityType = t('plots_title');
        break;
      case OperationLogEntityType.PlotScene:
        const plotScene = await db.query.plotScenes.findFirst({
          where: and(eq(plotScenes.id, entityId), eq(plotScenes.isDeleted, false)),
          columns: { plotId: true, sceneId: true },
        });
        if (plotScene) {
          const [relatedPlot, relatedScene] = await Promise.all([
            db.query.plots.findFirst({
              where: eq(plots.id, plotScene.plotId),
              columns: { name: true },
            }),
            db.query.scenes.findFirst({
              where: eq(scenes.id, plotScene.sceneId),
              columns: { name: true },
            }),
          ]);
          entitySpecificName = `${relatedPlot?.name || t('plots_title')} — ${relatedScene?.name || t('scenes_title')}`;
        }
        translatedEntityType = t('plot_scenes');
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
          const owner = await resolveRelationEntityName(
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
                : entityReferenceName ||
                  (Array.isArray(decodedValue) ? decodedValue.join(', ') : String(decodedValue)),
            entityname: owner.name || t('unknown_entity'),
            entitytype: owner.type || t('unknown_entity_type'),
          });
        }
        translatedEntityType = t('custom_attribute_value');
        break;
      default:
        return resolveAdvancedEntityName(db, entityType, entityId, storyId, t);
    }
    if (entitySpecificName) {
      return `${translatedEntityType} - ${entitySpecificName}`;
    } else {
      // If no specific name found, but entityType is known, return just the translated type
      return translatedEntityType;
    }
  }

  // Private helper to resolve the name and type of a related entity (e.g., from TagRelation)
  static getEntityIdentifier(
    db: AppDrizzleClient,
    entityTypeString: string,
    entityId: string,
    storyId: string,
    t: TFunction,
  ): Promise<string | undefined> {
    return getEntityIdentifier(db, entityTypeString, entityId, storyId, t);
  }
}
