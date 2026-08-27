import type {
  ChapterAnchor,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

/**
 * Anchors arriving from a server.
 *
 * Nothing to reconcile beyond the row itself: an anchor is a statement about one container, and two
 * of them for the same container are two stretches rather than a disagreement. That is why this has
 * none of the duplicate-pair handling the relation handlers carry - the model stopped having pairs.
 */
export class ChapterAnchorClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'ChapterAnchor';
  private dbInstance: AppDrizzleClient | null = null;

  setDb(dbInstance: AppDrizzleClient): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient {
    if (!this.dbInstance) {
      throw new Error('ChapterAnchorClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(storyId: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName || !update.id) return;
    const anchor = update.data as ChapterAnchor;

    await this.db.insert(schema.chapterAnchors).values({
      ...anchor,
      id: update.id,
      storyId,
      createdAt: new Date(anchor.createdAt),
      updatedAt: new Date(anchor.updatedAt),
      deletedAt: anchor.deletedAt ? new Date(anchor.deletedAt) : null,
    });
  }

  async applyUpdate(storyId: string, update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName || !update.id || !update.changes) return;

    const local = await this.db.query.chapterAnchors.findFirst({
      where: eq(schema.chapterAnchors.id, update.id),
    });
    if (!local) {
      console.warn(`ChapterAnchor ${update.id} not found locally for update. Skipping.`);
      return;
    }

    const changes = update.changes as Partial<ChapterAnchor>;
    await this.db
      .update(schema.chapterAnchors)
      .set({
        ...changes,
        storyId,
        updatedAt: new Date(update.operationTime || new Date()),
        createdAt: changes.createdAt ? new Date(changes.createdAt) : undefined,
        deletedAt: changes.deletedAt ? new Date(changes.deletedAt) : undefined,
      })
      .where(eq(schema.chapterAnchors.id, update.id));
  }

  async applyDelete(storyId: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName || !update.id) return;

    await this.db
      .update(schema.chapterAnchors)
      .set({ storyId, isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.chapterAnchors.id, update.id));
  }

  async getById(id: string): Promise<ChapterAnchor | undefined> {
    return this.db.query.chapterAnchors.findFirst({
      where: eq(schema.chapterAnchors.id, id),
    }) as Promise<ChapterAnchor | undefined>;
  }
}
