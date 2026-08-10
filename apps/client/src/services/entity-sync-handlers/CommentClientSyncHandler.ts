import { Comment, CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { AppDrizzleClient } from '../../db';
import { comments } from '../../db/schema';
import { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

export class CommentClientSyncHandler implements ClientSyncEntityHandler {
  entityName = 'Comment';
  private dbInstance: AppDrizzleClient | null = null;

  setDb(db: AppDrizzleClient): void { this.dbInstance = db; }
  private get db(): AppDrizzleClient {
    if (!this.dbInstance) throw new Error('CommentClientSyncHandler: database not set.');
    return this.dbInstance;
  }

  async applyCreate(storyId: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;
    const data = update.data as Comment;
    await this.db.insert(comments).values({
      ...data,
      id: update.id!,
      storyId,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      deletedAt: data.deletedAt ? new Date(data.deletedAt) : null,
    }).onConflictDoNothing().run();
  }

  async applyUpdate(_storyId: string, update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;
    const changes = update.changes as Partial<Comment>;
    await this.db.update(comments).set({
      ...changes,
      createdAt: changes.createdAt ? new Date(changes.createdAt) : undefined,
      updatedAt: changes.updatedAt ? new Date(changes.updatedAt) : new Date(),
      deletedAt: changes.deletedAt ? new Date(changes.deletedAt) : changes.deletedAt,
    }).where(eq(comments.id, update.id!)).run();
  }

  async applyDelete(_storyId: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;
    await this.db.update(comments).set({
      isDeleted: true,
      deletedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(comments.id, update.id!)).run();
  }

  async getById(id: string): Promise<Comment | undefined> {
    return await this.db.query.comments.findFirst({ where: eq(comments.id, id) }) as Comment | undefined;
  }
}
