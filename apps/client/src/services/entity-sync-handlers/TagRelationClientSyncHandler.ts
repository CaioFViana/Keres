import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import type { TagRelation } from '@keres/shared/entities/Tag';
import { eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

/** Applies the server's tag assignments, including assignments made by another collaborator. */
export class TagRelationClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'TagRelation';
  private dbInstance: AppDrizzleClient | null = null;

  setDb(dbInstance: AppDrizzleClient): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient {
    if (!this.dbInstance) {
      throw new Error('TagRelationClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(storyId: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;
    if (!update.id) {
      console.error(`Missing ID for create operation on ${this.entityName}`);
      return;
    }

    const relation = update.data as TagRelation;
    await this.db.insert(schema.tagRelations).values({
      ...relation,
      id: update.id,
      storyId,
      createdAt: new Date(relation.createdAt),
      updatedAt: new Date(relation.updatedAt),
      deletedAt: relation.deletedAt ? new Date(relation.deletedAt) : null,
    });
  }

  async applyUpdate(storyId: string, update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;
    if (!update.id || !update.changes) {
      console.error(`Missing ID or changes for update operation on ${this.entityName}`);
      return;
    }

    const changes = update.changes as Partial<TagRelation>;
    await this.db
      .update(schema.tagRelations)
      .set({
        ...changes,
        storyId,
        updatedAt: new Date(),
        createdAt: changes.createdAt ? new Date(changes.createdAt) : undefined,
        deletedAt: changes.deletedAt ? new Date(changes.deletedAt) : undefined,
      })
      .where(eq(schema.tagRelations.id, update.id));
  }

  async applyDelete(storyId: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;
    if (!update.id) {
      console.error(`Missing ID for delete operation on ${this.entityName} in story ${storyId}`);
      return;
    }

    await this.db
      .update(schema.tagRelations)
      .set({ storyId, isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.tagRelations.id, update.id));
  }

  async getById(id: string): Promise<TagRelation | undefined> {
    return this.db.query.tagRelations.findFirst({ where: eq(schema.tagRelations.id, id) });
  }
}
