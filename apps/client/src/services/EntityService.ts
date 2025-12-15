import { eq } from 'drizzle-orm';
import {
  stories,
  characters,
  notes,
  locations,
  worldRules,
  tags,
  users,
  operationLogs,
  chapters,
  scenes,
  choices,
  galleries,
  items,
} from '../db/schemas';
import { OperationLogEntityType } from '@keres/shared';
import { AppDrizzleClient } from '../db';

export class EntityService {
  static async getEntityName(
    db: AppDrizzleClient,
    entityType: OperationLogEntityType,
    entityId: string
  ): Promise<string | undefined> {
    switch (entityType) {
      case OperationLogEntityType.Story:
        const story = await db.query.stories.findFirst({
          where: eq(stories.id, entityId),
          columns: { title: true },
        });
        return story?.title;
      case OperationLogEntityType.Character:
        const character = await db.query.characters.findFirst({
          where: eq(characters.id, entityId),
          columns: { name: true },
        });
        return character?.name;
      case OperationLogEntityType.Note:
        const note = await db.query.notes.findFirst({
          where: eq(notes.id, entityId),
          columns: { title: true },
        });
        return note?.title;
      case OperationLogEntityType.Location:
        const location = await db.query.locations.findFirst({
          where: eq(locations.id, entityId),
          columns: { name: true },
        });
        return location?.name;
      case OperationLogEntityType.WorldRule:
        const worldRule = await db.query.worldRules.findFirst({
          where: eq(worldRules.id, entityId),
          columns: { title: true },
        });
        return worldRule?.title;
      case OperationLogEntityType.Tag:
        const tag = await db.query.tags.findFirst({
          where: eq(tags.id, entityId),
          columns: { name: true },
        });
        return tag?.name;
      case OperationLogEntityType.User:
        const user = await db.query.users.findFirst({
          where: eq(users.idUser, entityId),
          columns: { displayName: true },
        });
        return user?.displayName ?? undefined;
      case OperationLogEntityType.Chapter:
        const chapter = await db.query.chapters.findFirst({
          where: eq(chapters.id, entityId),
          columns: { name: true },
        });
        return chapter?.name;
      case OperationLogEntityType.Scene:
        const scene = await db.query.scenes.findFirst({
          where: eq(scenes.id, entityId),
          columns: { name: true },
        });
        return scene?.name;
      case OperationLogEntityType.Choice:
        return `Choice ID: ${entityId}`;
      case OperationLogEntityType.Gallery:
        return `Gallery ID: ${entityId}`;
      case OperationLogEntityType.Item:
        const item = await db.query.items.findFirst({
          where: eq(items.id, entityId),
          columns: { name: true },
        });
        return item?.name;
      case OperationLogEntityType.OperationLog:
        const opLog = await db.query.operationLogs.findFirst({
          where: eq(operationLogs.id, entityId),
          columns: { id: true },
        });
        return `Operation Log ID: ${opLog?.id}`;
      default:
        return undefined;
    }
  }
}