import { AttributeValue, CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

export class AttributeValueClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'AttributeValue';
  private dbInstance: AppDrizzleClient | null = null;

  setDb(dbInstance: AppDrizzleClient): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient {
    if (!this.dbInstance) {
      throw new Error('AttributeValueClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(storyId: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;
    if (!update.id) {
      console.error(`Missing ID for create operation on ${this.entityName}`);
      return;
    }

    const valueData = update.data as AttributeValue;

    await this.db.insert(schema.attributeValues).values({
      ...valueData,
      id: update.id,
      storyId,
      createdAt: new Date(valueData.createdAt),
      updatedAt: new Date(valueData.updatedAt),
      deletedAt: valueData.deletedAt ? new Date(valueData.deletedAt) : null,
    });
  }

  async applyUpdate(storyId: string, update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;
    if (!update.id || !update.changes) {
      console.error(`Missing ID or changes for update operation on ${this.entityName}`);
      return;
    }

    const valueChanges = update.changes as Partial<AttributeValue>;

    await this.db.update(schema.attributeValues)
      .set({
        ...valueChanges,
        updatedAt: new Date(),
        createdAt: valueChanges.createdAt ? new Date(valueChanges.createdAt) : undefined,
        deletedAt: valueChanges.deletedAt ? new Date(valueChanges.deletedAt) : undefined,
      })
      .where(eq(schema.attributeValues.id, update.id));
  }

  async applyDelete(storyId: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;
    if (!update.id) {
      console.error(`Missing ID for delete operation on ${this.entityName}`);
      return;
    }

    await this.db.update(schema.attributeValues)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.attributeValues.id, update.id));
  }

  async getById(id: string): Promise<AttributeValue | undefined> {
    const row = await this.db.query.attributeValues.findFirst({
      where: eq(schema.attributeValues.id, id),
    });
    return row as AttributeValue | undefined;
  }
}
