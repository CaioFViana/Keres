import type { CreateStoryUpdate, DeleteStoryUpdate, Sketch, UpdateStoryUpdate } from '@keres/shared';
import { eq } from 'drizzle-orm';
import type { AppDrizzleClient, AppDrizzleTransaction } from '../../db';
import * as schema from '../../db/schema';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

/**
 * Sketches arriving from a server. `content` travels as an object and is stored as one.
 */
export class SketchClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'Sketch';
  private dbInstance: AppDrizzleClient | AppDrizzleTransaction | null = null;

  setDb(dbInstance: AppDrizzleClient | AppDrizzleTransaction): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient | AppDrizzleTransaction {
    if (!this.dbInstance) {
      throw new Error('SketchClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(storyId: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName || !update.id) return;
    const sketch = update.data as Sketch;

    await this.db.insert(schema.sketches).values({
      ...sketch,
      id: update.id,
      storyId,
      createdAt: new Date(sketch.createdAt),
      updatedAt: new Date(sketch.updatedAt),
      deletedAt: sketch.deletedAt ? new Date(sketch.deletedAt) : null,
    });
  }

  async applyUpdate(storyId: string, update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName || !update.id || !update.changes) return;

    const local = await this.db.query.sketches.findFirst({
      where: eq(schema.sketches.id, update.id),
    });
    if (!local) {
      console.warn(`Sketch ${update.id} not found locally for update. Skipping.`);
      return;
    }

    const changes = update.changes as Partial<Sketch>;
    await this.db
      .update(schema.sketches)
      .set({
        ...changes,
        storyId,
        updatedAt: new Date(update.operationTime || new Date()),
        createdAt: changes.createdAt ? new Date(changes.createdAt) : undefined,
        deletedAt: changes.deletedAt ? new Date(changes.deletedAt) : undefined,
      })
      .where(eq(schema.sketches.id, update.id));
  }

  async applyDelete(storyId: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName || !update.id) return;

    await this.db
      .update(schema.sketches)
      .set({ storyId, isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.sketches.id, update.id));
  }

  async getById(id: string): Promise<Sketch | undefined> {
    return this.db.query.sketches.findFirst({
      where: eq(schema.sketches.id, id),
    }) as Promise<Sketch | undefined>;
  }
}
