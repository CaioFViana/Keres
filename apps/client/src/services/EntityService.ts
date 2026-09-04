import type { StorySchemaEntityType } from '@keres/shared';
import type { StoryVocabulary } from '@keres/shared/entities/Story';
import {
  AttributeType,
  decodeAttributeValue,
  OperationLogEntityType,
  resolveBasicOperationLogEntityName,
  suggestionDisplayValue,
} from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import type { TFunction } from 'i18next';
import type { AppDrizzleClient } from '../db';
import {
  attributeValues,
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
  locationRelations,
  noteRelations,
  notes,
  operationLogs,
  plots,
  plotScenes,
  routes,
  routeSteps,
  scenes,
  suggestions,
  storySchemaFields,
  tagRelations,
  tags,
  users,
} from '../db/schemas';
import {
  fromStoryNoun,
  loadStoryVocabulary,
  translateStoryNoun,
  unknownStoryNoun,
} from '../vocabulary/storyVocabularyLookup';
import { isStoryVocabularyEntityType } from '../vocabulary/resolveStoryTerm';
import { getEntityIdentifier, resolveRelationEntityName } from './EntityIdentifierResolver';
import { resolveAdvancedEntityName } from './EntityAdvancedNameResolver';
import { createClientEntitySolverContext } from './entity-solvers/ClientEntitySolverContext';

/** Reuses the singular translation key for each entity type that can receive a Story Schema. */
const STORY_SCHEMA_ENTITY_TYPE_SINGULAR_KEYS: Record<StorySchemaEntityType, string> = {
  Character: 'character',
  Location: 'location',
  Item: 'item',
  Scene: 'scene',
  Chapter: 'chapter',
  Note: 'note',
  WorldRule: 'world_rule',
};

export class EntityService {
  static async getEntityName(
    db: AppDrizzleClient,
    entityType: OperationLogEntityType,
    entityId: string,
    storyId: string,
    t: TFunction,
  ): Promise<string | undefined> {
    const basicName = await resolveBasicOperationLogEntityName(
      createClientEntitySolverContext(db, storyId, t),
      entityType,
      entityId,
    );
    if (basicName) return basicName;

    let translatedEntityType: string | undefined;
    let entitySpecificName: string | undefined;
    // Operation-log rows are resolved independently. Most entity types do not need custom
    // terminology, so keep the extra story read lazy and share it for a composite name.
    let vocabularyPromise: Promise<StoryVocabulary | null> | undefined;
    const vocabulary = () => (vocabularyPromise ??= loadStoryVocabulary(db, storyId));

    switch (entityType) {
      case OperationLogEntityType.User:
        const user = await db.query.users.findFirst({
          where: and(eq(users.idUser, entityId), eq(users.isDeleted, false)),
          columns: { displayName: true },
        });
        entitySpecificName = user?.displayName ?? undefined;
        translatedEntityType = t('user');
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
          entitySpecificName = `${fromStoryNoun(t, await vocabulary(), 'Scene')}: ${originScene?.name || unknownStoryNoun(t, await vocabulary(), 'Scene')} - ${choice.text}`;
        } else {
          entitySpecificName = `${t('unknown_choice')} ${t('id')}: ${entityId}`;
        }
        translatedEntityType = translateStoryNoun(t, await vocabulary(), 'Choice');
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
          entitySpecificName = `${relatedItem?.name || unknownStoryNoun(t, await vocabulary(), 'Item')} ${t('showed_in_scene')} ${targetScene?.name || unknownStoryNoun(t, await vocabulary(), 'Scene')}`;
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
            sceneName: scene?.name || unknownStoryNoun(t, await vocabulary(), 'Scene'),
          });
        }
        translatedEntityType = t('character_scene_relation');
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
          entitySpecificName = `${relatedPlot?.name || t('plots_title')} — ${relatedScene?.name || translateStoryNoun(t, await vocabulary(), 'Scene', true)}`;
        }
        translatedEntityType = t('plot_scenes');
        break;
      case OperationLogEntityType.RouteStep:
        const routeStep = await db.query.routeSteps.findFirst({
          where: and(
            eq(routeSteps.id, entityId),
            eq(routeSteps.storyId, storyId),
            eq(routeSteps.isDeleted, false),
          ),
          columns: { routeId: true, position: true, sceneId: true },
        });
        if (routeStep) {
          const [stepRoute, stepScene] = await Promise.all([
            db.query.routes.findFirst({
              where: and(eq(routes.id, routeStep.routeId), eq(routes.isDeleted, false)),
              columns: { name: true },
            }),
            db.query.scenes.findFirst({
              where: and(eq(scenes.id, routeStep.sceneId), eq(scenes.isDeleted, false)),
              columns: { name: true },
            }),
          ]);
          entitySpecificName = `${stepRoute?.name || t('unknown_entity')} — ${t('route_step')} ${routeStep.position + 1}: ${stepScene?.name || unknownStoryNoun(t, await vocabulary(), 'Scene')}`;
        }
        translatedEntityType = t('route_step');
        break;
      case OperationLogEntityType.StorySchemaField:
        const schemaField = await db.query.storySchemaFields.findFirst({
          where: and(eq(storySchemaFields.id, entityId), eq(storySchemaFields.storyId, storyId)),
          columns: { name: true, entityType: true },
        });
        if (schemaField) {
          const entityTypeLabelKey =
            STORY_SCHEMA_ENTITY_TYPE_SINGULAR_KEYS[schemaField.entityType as StorySchemaEntityType];
          entitySpecificName = `${schemaField.name} (${
            isStoryVocabularyEntityType(schemaField.entityType)
              ? translateStoryNoun(t, await vocabulary(), schemaField.entityType)
              : entityTypeLabelKey
                ? t(entityTypeLabelKey)
                : schemaField.entityType
          })`;
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
    }
    // If no specific name found, but entityType is known, return just the translated type.
    return translatedEntityType;
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
