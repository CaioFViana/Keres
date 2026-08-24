import type {
  ChoiceCheck,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

export class ChoiceCheckClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'ChoiceCheck';
  private dbInstance: AppDrizzleClient | null = null;

  setDb(dbInstance: AppDrizzleClient): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient {
    if (!this.dbInstance) {
      throw new Error('ChoiceCheckClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(entityId: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for create operation on ${this.entityName}`);
      return;
    }

    const data = update.data as ChoiceCheck;

    await this.db.insert(schema.choiceChecks).values({
      ...data,
      id: update.id,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      deletedAt: data.deletedAt ? new Date(data.deletedAt) : null,
    });
    console.log(`Applied create for ChoiceCheck ${update.id}`);
  }

  async applyUpdate(entityId: string, update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id || !update.changes) {
      console.error(`Missing ID or changes for update operation on ${this.entityName}`);
      return;
    }

    const changes = update.changes as Partial<ChoiceCheck>;

    await this.db
      .update(schema.choiceChecks)
      .set({
        ...changes,
        updatedAt: new Date(),
        createdAt: changes.createdAt ? new Date(changes.createdAt) : undefined,
        deletedAt: changes.deletedAt ? new Date(changes.deletedAt) : undefined,
      })
      .where(eq(schema.choiceChecks.id, update.id));
    console.log(`Applied update for ChoiceCheck ${update.id}`);
  }

  async applyDelete(entityId: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for delete operation on ${this.entityName}`);
      return;
    }

    await this.db
      .update(schema.choiceChecks)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.choiceChecks.id, update.id));
    console.log(`Applied delete for ChoiceCheck ${update.id}`);
  }

  async getById(id: string): Promise<ChoiceCheck | undefined> {
    const entity = await this.db.query.choiceChecks.findFirst({
      where: eq(schema.choiceChecks.id, id),
    });
    return entity;
  }
}
