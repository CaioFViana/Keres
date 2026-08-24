import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import { omitClientProtectedFields, toEntityColumns } from '../entityTableRegistry';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

export class SuggestionClientSyncHandler implements ClientSyncEntityHandler {
  entityName = 'Suggestion';
  private dbInstance: AppDrizzleClient | null = null;

  setDb(dbInstance: AppDrizzleClient): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient {
    if (!this.dbInstance) {
      throw new Error('SuggestionClientSyncHandler: Drizzle client (db) is not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(storyId: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName || !update.id) return;

    const data = omitClientProtectedFields(this.entityName, update.data);
    await this.db.insert(schema.suggestions).values({
      ...toEntityColumns(this.entityName, data),
      id: update.id,
      storyId,
      type: data.type,
      value: data.value,
      createdAt: new Date(data.createdAt ?? Date.now()),
      updatedAt: new Date(data.updatedAt ?? Date.now()),
      deletedAt: data.deletedAt ? new Date(data.deletedAt) : null,
      version: data.version ?? 1,
      isDeleted: data.isDeleted ?? false,
    });
  }

  async applyUpdate(_storyId: string, update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName || !update.id) return;

    const columns = toEntityColumns(
      this.entityName,
      omitClientProtectedFields(this.entityName, update.changes),
    );
    if (Object.keys(columns).length === 0) return;

    await this.db
      .update(schema.suggestions)
      .set({ ...columns, updatedAt: new Date() })
      .where(eq(schema.suggestions.id, update.id));
  }

  async applyDelete(_storyId: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName || !update.id) return;

    await this.db
      .update(schema.suggestions)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.suggestions.id, update.id));
  }

  async getById(id: string): Promise<unknown> {
    return this.db.query.suggestions.findFirst({
      where: eq(schema.suggestions.id, id),
    });
  }
}
