import type {
  CreateStoryUpdate,
  DeleteStoryUpdate,
  StoryArc,
  UpdateStoryUpdate,
} from '@keres/shared';
import { eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

export class StoryArcClientSyncHandler implements ClientSyncEntityHandler {
  entityName = 'StoryArc';
  private dbInstance: AppDrizzleClient | null = null;

  setDb(dbInstance: AppDrizzleClient): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient {
    if (!this.dbInstance)
      throw new Error('StoryArcClientSyncHandler: Drizzle client (db) not set.');
    return this.dbInstance;
  }

  async applyCreate(storyId: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName || !update.id) return;
    const data = update.data as StoryArc;
    await this.db.insert(schema.storyArcs).values({
      ...data,
      id: update.id,
      storyId,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      deletedAt: data.deletedAt ? new Date(data.deletedAt) : null,
    });
  }

  async applyUpdate(_storyId: string, update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName || !update.id || !update.changes) return;
    const changes = update.changes as Partial<StoryArc>;
    await this.db
      .update(schema.storyArcs)
      .set({
        ...changes,
        createdAt: changes.createdAt ? new Date(changes.createdAt) : undefined,
        updatedAt: new Date(),
        deletedAt: changes.deletedAt ? new Date(changes.deletedAt) : undefined,
      })
      .where(eq(schema.storyArcs.id, update.id));
  }

  async applyDelete(_storyId: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName || !update.id) return;
    await this.db
      .update(schema.storyArcs)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.storyArcs.id, update.id));
  }

  async getById(id: string): Promise<StoryArc | undefined> {
    return this.db.query.storyArcs.findFirst({ where: eq(schema.storyArcs.id, id) });
  }
}
