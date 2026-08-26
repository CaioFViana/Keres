import type {
  ChoiceCheckGroup,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

export class ChoiceCheckGroupClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'ChoiceCheckGroup';
  private dbInstance: AppDrizzleClient | null = null;

  setDb(dbInstance: AppDrizzleClient): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient {
    if (!this.dbInstance) {
      throw new Error('ChoiceCheckGroupClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(entityId: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for create operation on ${this.entityName}`);
      return;
    }

    const data = update.data as ChoiceCheckGroup;

    await this.db.insert(schema.choiceCheckGroups).values({
      ...data,
      id: update.id,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      deletedAt: data.deletedAt ? new Date(data.deletedAt) : null,
    });
    console.log(`Applied create for ChoiceCheckGroup ${update.id}`);
  }

  async applyUpdate(entityId: string, update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id || !update.changes) {
      console.error(`Missing ID or changes for update operation on ${this.entityName}`);
      return;
    }

    const changes = update.changes as Partial<ChoiceCheckGroup>;

    await this.db
      .update(schema.choiceCheckGroups)
      .set({
        ...changes,
        updatedAt: new Date(),
        createdAt: changes.createdAt ? new Date(changes.createdAt) : undefined,
        deletedAt: changes.deletedAt ? new Date(changes.deletedAt) : undefined,
      })
      .where(eq(schema.choiceCheckGroups.id, update.id));
    console.log(`Applied update for ChoiceCheckGroup ${update.id}`);
  }

  async applyDelete(entityId: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for delete operation on ${this.entityName}`);
      return;
    }

    await this.db
      .update(schema.choiceCheckGroups)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.choiceCheckGroups.id, update.id));
    console.log(`Applied delete for ChoiceCheckGroup ${update.id}`);
  }

  async getById(id: string): Promise<ChoiceCheckGroup | undefined> {
    const entity = await this.db.query.choiceCheckGroups.findFirst({
      where: eq(schema.choiceCheckGroups.id, id),
    });
    return entity;
  }
}
