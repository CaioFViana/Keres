import { OperationLogEntityType } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { TFunction } from 'i18next';
import { AppDrizzleClient } from '../db';
import {
  chapters,
  characterRelations,
  characters,
  items,
  itemJourneys,
  locations,
  noteRelations,
  notes,
  operationLogs,
  scenes,
  stories,
  tagRelations,
  tags,
  users,
  worldRules
} from '../db/schemas';

export class EntityService {
  static async getEntityName(
    db: AppDrizzleClient,
    entityType: OperationLogEntityType,
    entityId: string,
    storyId: string,
    t: TFunction
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
        translatedEntityType = t('story')
        break;
      case OperationLogEntityType.Character:
        const character = await db.query.characters.findFirst({
          where: and(eq(characters.id, entityId), eq(characters.isDeleted, false)),
          columns: { name: true },
        });
        entitySpecificName = character?.name;
        translatedEntityType = t('character')
        break;
      case OperationLogEntityType.Note:
        const note = await db.query.notes.findFirst({
          where: and(eq(notes.id, entityId), eq(notes.isDeleted, false)),
          columns: { title: true },
        });
        entitySpecificName = note?.title;
        translatedEntityType = t('note')
        break;
      case OperationLogEntityType.Location:
        const location = await db.query.locations.findFirst({
          where: and(eq(locations.id, entityId), eq(locations.isDeleted, false)),
          columns: { name: true },
        });
        entitySpecificName = location?.name;
        translatedEntityType = t('location')
        break;
      case OperationLogEntityType.WorldRule:
        const worldRule = await db.query.worldRules.findFirst({
          where: and(eq(worldRules.id, entityId), eq(worldRules.isDeleted, false)),
          columns: { title: true },
        });
        entitySpecificName = worldRule?.title;
        translatedEntityType = t('world_rule')
        break;
      case OperationLogEntityType.Tag:
        const tag = await db.query.tags.findFirst({
          where: and(eq(tags.id, entityId), eq(tags.isDeleted, false)),
          columns: { name: true },
        });
        entitySpecificName = tag?.name;
        translatedEntityType = t('tag')
        break;
      case OperationLogEntityType.User:
        const user = await db.query.users.findFirst({
          where: and(eq(users.idUser, entityId), eq(users.isDeleted, false)),
          columns: { displayName: true },
        });
        entitySpecificName = user?.displayName ?? undefined;
        translatedEntityType = t('user')
        break;
      case OperationLogEntityType.Chapter:
        const chapter = await db.query.chapters.findFirst({
          where: and(eq(chapters.id, entityId), eq(chapters.isDeleted, false)),
          columns: { name: true },
        });
        entitySpecificName = chapter?.name;
        translatedEntityType = t('chapter')
        break;
      case OperationLogEntityType.Scene:
        const scene = await db.query.scenes.findFirst({
          where: and(eq(scenes.id, entityId), eq(scenes.isDeleted, false)),
          columns: { name: true },
        });
        entitySpecificName = scene?.name;
        translatedEntityType = t('scene')
        break;
      case OperationLogEntityType.Choice:
        // For entities without a natural 'name' field, we construct a descriptive string
        entitySpecificName = `${t('choice')} ${t('id')}: ${entityId}`; // Use t() for 'ID'
        translatedEntityType = t('choice')
        break;
      case OperationLogEntityType.Gallery:
        entitySpecificName = `${t('gallery')} ${t('id')}: ${entityId}`; // Use t() for 'ID'
        translatedEntityType = t('gallery')
        break;
      case OperationLogEntityType.Item:
        const item = await db.query.items.findFirst({
          where: and(eq(items.id, entityId), eq(items.isDeleted, false)),
          columns: { name: true },
        });
        entitySpecificName = item?.name;
        translatedEntityType = t('item')
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
          columns: { charId1: true, charId2: true },
        });

        if (charRelation) {
          const char1 = await db.query.characters.findFirst({
            where: and(eq(characters.id, charRelation.charId1), eq(characters.isDeleted, false)),
            columns: { name: true },
          });
          const char2 = await db.query.characters.findFirst({
            where: and(eq(characters.id, charRelation.charId2), eq(characters.isDeleted, false)),
            columns: { name: true },
          });
          entitySpecificName = `${char1?.name || t('unknown_character')} - ${char2?.name || t('unknown_character')} ${t('relation')}`;
        }
        translatedEntityType = t('character_relation')
        break;
      case OperationLogEntityType.TagRelation:
        const tagRel = await db.query.tagRelations.findFirst({
          where: and(eq(tagRelations.id, entityId), eq(tagRelations.storyId, storyId), eq(tagRelations.isDeleted, false)),
          columns: { tagId: true, relationId: true, relationType: true },
        });

        if (tagRel) {
          const tag = await db.query.tags.findFirst({
            where: and(eq(tags.id, tagRel.tagId), eq(tags.storyId, storyId), eq(tags.isDeleted, false)),
            columns: { name: true },
          });
          const related = await EntityService._resolveRelationEntityName(
            db,
            tagRel.relationType as OperationLogEntityType,
            tagRel.relationId,
            storyId,
            t
          );
          // Correctly pass string values for entityname and entitytype to the translation function
          entitySpecificName = t('tag_attributed_to_entity', {
            tagname: tag?.name || t('unknown_tag'),
            entityname: related.name || t('unknown_entity'),
            entitytype: related.type || t('unknown_entity_type')
          });
        }
        translatedEntityType = t('tag_relation'); // Assuming 'tag_relation' is a translation key
        break;
      case OperationLogEntityType.NoteRelation:
        const noteRel = await db.query.noteRelations.findFirst({
          where: and(eq(noteRelations.id, entityId), eq(noteRelations.storyId, storyId), eq(noteRelations.isDeleted, false)),
          columns: { noteId: true, relationId: true, relationType: true },
        });

        if (noteRel) {
          const note = await db.query.notes.findFirst({
            where: and(eq(notes.id, noteRel.noteId), eq(notes.storyId, storyId), eq(notes.isDeleted, false)),
            columns: { title: true },
          });
          const related = await EntityService._resolveRelationEntityName(
            db,
            noteRel.relationType as OperationLogEntityType,
            noteRel.relationId,
            storyId,
            t
          );
          entitySpecificName = t('note_attributed_to_entity', {
            notename: note?.title || t('unknown_note'),
            entityname: related.name || t('unknown_entity'),
            entitytype: related.type || t('unknown_entity_type')
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
        translatedEntityType = t('operation_log')
        break;
      default:
        return undefined; // If entityType is unknown, we can't provide a name
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
    t: TFunction
  ): Promise<{ name: string | undefined; type: string | undefined }> {
    let name: string | undefined;
    let type: string | undefined;

    switch (relationType) {
      case OperationLogEntityType.Story:
        const story = await db.query.stories.findFirst({ where: and(eq(stories.id, relationId), eq(stories.id, storyId), eq(stories.isDeleted, false)), columns: { title: true } });
        name = story?.title;
        type = t('story');
        break;
      case OperationLogEntityType.Character:
        const character = await db.query.characters.findFirst({ where: and(eq(characters.id, relationId), eq(characters.storyId, storyId), eq(characters.isDeleted, false)), columns: { name: true } });
        name = character?.name;
        type = t('character');
        break;
      case OperationLogEntityType.Note:
        const note = await db.query.notes.findFirst({ where: and(eq(notes.id, relationId), eq(notes.storyId, storyId), eq(notes.isDeleted, false)), columns: { title: true } });
        name = note?.title;
        type = t('note');
        break;
      case OperationLogEntityType.Location:
        const location = await db.query.locations.findFirst({ where: and(eq(locations.id, relationId), eq(locations.storyId, storyId), eq(locations.isDeleted, false)), columns: { name: true } });
        name = location?.name;
        type = t('location');
        break;
      case OperationLogEntityType.WorldRule:
        const worldRule = await db.query.worldRules.findFirst({ where: and(eq(worldRules.id, relationId), eq(worldRules.storyId, storyId), eq(worldRules.isDeleted, false)), columns: { title: true } });
        name = worldRule?.title;
        type = t('world_rule');
        break;
      case OperationLogEntityType.Chapter:
        const chapter = await db.query.chapters.findFirst({ where: and(eq(chapters.id, relationId), eq(chapters.storyId, storyId), eq(chapters.isDeleted, false)), columns: { name: true } });
        name = chapter?.name;
        type = t('chapter');
        break;
      case OperationLogEntityType.Scene:
        const scene = await db.query.scenes.findFirst({ where: and(eq(scenes.id, relationId), eq(scenes.storyId, storyId), eq(scenes.isDeleted, false)), columns: { name: true } });
        name = scene?.name;
        type = t('scene');
        break;
      case OperationLogEntityType.Item:
        const item = await db.query.items.findFirst({ where: and(eq(items.id, relationId), eq(items.storyId, storyId), eq(items.isDeleted, false)), columns: { name: true } });
        name = item?.name;
        type = t('item');
        break;
      case OperationLogEntityType.ItemJourney:
        const itemJourney = await db.query.itemJourneys.findFirst({
          where: and(eq(itemJourneys.id, relationId), eq(itemJourneys.storyId, storyId), eq(itemJourneys.isDeleted, false)),
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
        const noteRelation = await db.query.noteRelations.findFirst({ where: and(eq(noteRelations.id, relationId), eq(noteRelations.storyId, storyId), eq(noteRelations.isDeleted, false)), columns: { noteId: true, relationId: true, relationType: true } });
        if (noteRelation) {
          const note = await db.query.notes.findFirst({ where: and(eq(notes.id, noteRelation.noteId), eq(notes.storyId, storyId), eq(notes.isDeleted, false)), columns: { title: true } });
          const relatedEntity = await EntityService._resolveRelationEntityName(
            db,
            noteRelation.relationType as OperationLogEntityType,
            noteRelation.relationId,
            storyId,
            t
          );
          name = t('note_attributed_to_entity_short', {
            notename: note?.title || t('unknown_note'),
            entityname: relatedEntity.name || t('unknown_entity'),
            entitytype: relatedEntity.type || t('unknown_entity_type')
          });
          type = t('note_relation');
        }
        break;
      default:
        name = undefined;
        type = t('unknown_entity_type');
    }
    return { name, type };
  }
}