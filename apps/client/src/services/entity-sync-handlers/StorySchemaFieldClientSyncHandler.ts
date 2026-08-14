import {
  CreateStoryUpdate,
  DeleteStoryUpdate,
  StorySchemaField,
  UpdateStoryUpdate,
} from '@keres/shared';
import { eq } from 'drizzle-orm';
import { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import { createULID } from '../../utils/entityUtils';
import { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

export class StorySchemaFieldClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'StorySchemaField';
  private dbInstance: AppDrizzleClient | null = null;

  setDb(dbInstance: AppDrizzleClient): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient {
    if (!this.dbInstance) {
      throw new Error('StorySchemaFieldClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(storyId: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;
    if (!update.id) {
      console.error(`Missing ID for create operation on ${this.entityName}`);
      return;
    }

    const fieldData = update.data as StorySchemaField;

    await this.db.insert(schema.storySchemaFields).values({
      ...fieldData,
      id: update.id,
      storyId,
      createdAt: new Date(fieldData.createdAt),
      updatedAt: new Date(fieldData.updatedAt),
      deletedAt: fieldData.deletedAt ? new Date(fieldData.deletedAt) : null,
    });
  }

  async applyUpdate(storyId: string, update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;
    if (!update.id || !update.changes) {
      console.error(`Missing ID or changes for update operation on ${this.entityName}`);
      return;
    }

    const fieldChanges = update.changes as Partial<StorySchemaField>;

    await this.db
      .update(schema.storySchemaFields)
      .set({
        ...fieldChanges,
        updatedAt: new Date(),
        createdAt: fieldChanges.createdAt ? new Date(fieldChanges.createdAt) : undefined,
        deletedAt: fieldChanges.deletedAt ? new Date(fieldChanges.deletedAt) : undefined,
      })
      .where(eq(schema.storySchemaFields.id, update.id));
  }

  async applyDelete(storyId: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;
    if (!update.id) {
      console.error(`Missing ID for delete operation on ${this.entityName}`);
      return;
    }

    const existing = await this.db.query.storySchemaFields.findFirst({
      where: eq(schema.storySchemaFields.id, update.id),
    });
    if (!existing || existing.isDeleted) {
      // Não existe localmente ainda (pull fora de ordem) ou já foi aplicado - idempotente.
      return;
    }

    // Muta a key ao aplicar a exclusão remota, mesma razão do lado que efetivamente apagou (ver
    // StorySchemaFieldService.deleteField): a constraint unique(storyId, entityType, key) local
    // não é filtrada por isDeleted, então sem isto este dispositivo não conseguiria recriar um
    // campo com a mesma chave depois.
    await this.db
      .update(schema.storySchemaFields)
      .set({
        key: `${existing.key}__deleted_${createULID()}`,
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.storySchemaFields.id, update.id));
  }

  async getById(id: string): Promise<StorySchemaField | undefined> {
    const row = await this.db.query.storySchemaFields.findFirst({
      where: eq(schema.storySchemaFields.id, id),
    });
    return row as StorySchemaField | undefined;
  }
}
