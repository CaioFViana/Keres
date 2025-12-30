import { OperationLogEntityType } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { TFunction } from 'i18next';
import { AppDrizzleClient } from '../db';
import {
  chapters,
  characters,
  items,
  locations,
  notes,
  operationLogs,
  scenes,
  stories,
  tags,
  users,
  worldRules,
  characterRelations
} from '../db/schemas';

export class EntityService {
  static async getEntityName(
    db: AppDrizzleClient,
    entityType: OperationLogEntityType,
    entityId: string,
    t: TFunction
  ): Promise<string | undefined> {
    let translatedEntityType: string | undefined;
    let entitySpecificName: string | undefined;

    switch (entityType) {
      case OperationLogEntityType.Story:
        const story = await db.query.stories.findFirst({
          where: eq(stories.id, entityId),
          columns: { title: true },
        });
        entitySpecificName = story?.title;
        translatedEntityType = t('story')
        break;
      case OperationLogEntityType.Character:
        const character = await db.query.characters.findFirst({
          where: eq(characters.id, entityId),
          columns: { name: true },
        });
        entitySpecificName = character?.name;
        translatedEntityType = t('character')
        break;
      case OperationLogEntityType.Note:
        const note = await db.query.notes.findFirst({
          where: eq(notes.id, entityId),
          columns: { title: true },
        });
        entitySpecificName = note?.title;
        translatedEntityType = t('note')
        break;
      case OperationLogEntityType.Location:
        const location = await db.query.locations.findFirst({
          where: eq(locations.id, entityId),
          columns: { name: true },
        });
        entitySpecificName = location?.name;
        translatedEntityType = t('location')
        break;
      case OperationLogEntityType.WorldRule:
        const worldRule = await db.query.worldRules.findFirst({
          where: eq(worldRules.id, entityId),
          columns: { title: true },
        });
        entitySpecificName = worldRule?.title;
        translatedEntityType = t('world_rule')
        break;
      case OperationLogEntityType.Tag:
        const tag = await db.query.tags.findFirst({
          where: eq(tags.id, entityId),
          columns: { name: true },
        });
        entitySpecificName = tag?.name;
        translatedEntityType = t('tag')
        break;
      case OperationLogEntityType.User:
        const user = await db.query.users.findFirst({
          where: eq(users.idUser, entityId),
          columns: { displayName: true },
        });
        entitySpecificName = user?.displayName ?? undefined;
        translatedEntityType = t('user')
        break;
      case OperationLogEntityType.Chapter:
        const chapter = await db.query.chapters.findFirst({
          where: eq(chapters.id, entityId),
          columns: { name: true },
        });
        entitySpecificName = chapter?.name;
        translatedEntityType = t('chapter')
        break;
      case OperationLogEntityType.Scene:
        const scene = await db.query.scenes.findFirst({
          where: eq(scenes.id, entityId),
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
          where: eq(items.id, entityId),
          columns: { name: true },
        });
        entitySpecificName = item?.name;
        translatedEntityType = t('item')
        break;
      case OperationLogEntityType.CharacterRelation:
        const charRelation = await db.query.characterRelations.findFirst({
          where: eq(characterRelations.id, entityId),
          columns: { charId1: true, charId2: true },
        });

        if (charRelation) {
          const char1 = await db.query.characters.findFirst({
            where: eq(characters.id, charRelation.charId1),
            columns: { name: true },
          });
          const char2 = await db.query.characters.findFirst({
            where: eq(characters.id, charRelation.charId2),
            columns: { name: true },
          });
          entitySpecificName = `${char1?.name || t('unknown_character')} - ${char2?.name || t('unknown_character')} ${t('relation')}`;
        }
        translatedEntityType = t('character_relation')
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
}