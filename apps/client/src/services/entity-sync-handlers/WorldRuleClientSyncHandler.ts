import { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { WorldRule } from '@keres/shared/entities/WorldRule'; // Import the WorldRule entity interface
import { eq } from 'drizzle-orm';
import { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

export class WorldRuleClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'WorldRule';
  private dbInstance: AppDrizzleClient | null = null;

  setDb(dbInstance: AppDrizzleClient): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient {
    if (!this.dbInstance) {
      throw new Error('WorldRuleClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(storyId: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for create operation on ${this.entityName}`);
      return;
    }

    const worldRuleData = update.data as WorldRule;

    await this.db.insert(schema.worldRules).values({
      ...worldRuleData,
      id: update.id,
      storyId: storyId,
      createdAt: new Date(worldRuleData.createdAt),
      updatedAt: new Date(worldRuleData.updatedAt),
      deletedAt: worldRuleData.deletedAt ? new Date(worldRuleData.deletedAt) : null,
    });
    console.log(`Applied create for WorldRule ${update.id} in story ${storyId}`);
  }

  async applyUpdate(storyId: string, update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id || !update.changes) {
      console.error(`Missing ID or changes for update operation on ${this.entityName}`);
      return;
    }

    const worldRuleChanges = update.changes as Partial<WorldRule>;

    await this.db
      .update(schema.worldRules)
      .set({
        ...worldRuleChanges,
        storyId: storyId,
        updatedAt: new Date(), // Always update updatedAt on change
        // Ensure date fields are correctly converted if they come as strings
        createdAt: worldRuleChanges.createdAt ? new Date(worldRuleChanges.createdAt) : undefined,
        deletedAt: worldRuleChanges.deletedAt ? new Date(worldRuleChanges.deletedAt) : undefined,
      })
      .where(eq(schema.worldRules.id, update.id));
    console.log(`Applied update for WorldRule ${update.id}`);
  }

  async applyDelete(storyId: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for delete operation on ${this.entityName} in story ${storyId}`);
      return;
    }

    await this.db
      .update(schema.worldRules)
      .set({
        storyId: storyId,
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.worldRules.id, update.id));
    console.log(`Applied delete for WorldRule ${update.id} in story ${storyId}`);
  }

  async getById(id: string): Promise<WorldRule | undefined> {
    const worldRule = await this.db.query.worldRules.findFirst({
      where: eq(schema.worldRules.id, id),
    });
    return worldRule;
  }
}
