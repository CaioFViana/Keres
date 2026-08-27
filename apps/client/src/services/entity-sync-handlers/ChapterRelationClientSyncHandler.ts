import type {
  ChapterRelation,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { and, eq, ne, or } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

/**
 * Chronology relations arriving from a server.
 *
 * **The ids keep the order they were sent in**, unlike `CharacterRelationClientSyncHandler` which
 * works against a sorted pair: `before` and `during` are directional, so the two columns are a
 * sequence and sorting them would reverse the statement.
 *
 * The local table holds one live row per *unordered* pair, so an arrival that collides with one
 * already here has to be reconciled rather than inserted - the newer `updatedAt` wins, the same rule
 * the character handler applies for the same reason.
 */
const findLivePair = async (
  db: AppDrizzleClient,
  storyId: string,
  chapter1Id: string,
  chapter2Id: string,
  excludeId?: string,
): Promise<schema.ChapterRelationSelect | undefined> => {
  const conditions = [
    eq(schema.chapterRelations.storyId, storyId),
    eq(schema.chapterRelations.isDeleted, false),
    or(
      and(
        eq(schema.chapterRelations.chapter1Id, chapter1Id),
        eq(schema.chapterRelations.chapter2Id, chapter2Id),
      ),
      and(
        eq(schema.chapterRelations.chapter1Id, chapter2Id),
        eq(schema.chapterRelations.chapter2Id, chapter1Id),
      ),
    ),
  ];
  if (excludeId) conditions.push(ne(schema.chapterRelations.id, excludeId));
  return db.query.chapterRelations.findFirst({ where: and(...conditions) });
};

export class ChapterRelationClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'ChapterRelation';
  private dbInstance: AppDrizzleClient | null = null;

  setDb(dbInstance: AppDrizzleClient): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient {
    if (!this.dbInstance) {
      throw new Error('ChapterRelationClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  /** Newer wins; a tie leaves what is here, so applying the same page twice changes nothing. */
  private async resolveAgainstExisting(
    existing: schema.ChapterRelationSelect | undefined,
    incomingUpdatedAt: Date,
  ): Promise<'apply' | 'discard'> {
    if (!existing) return 'apply';
    if (incomingUpdatedAt <= existing.updatedAt) return 'discard';

    await this.db
      .update(schema.chapterRelations)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
        version: existing.version + 1,
      })
      .where(eq(schema.chapterRelations.id, existing.id));
    return 'apply';
  }

  async applyCreate(storyId: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;
    if (!update.id) {
      console.error(`Missing ID for create operation on ${this.entityName}`);
      return;
    }

    const relation = update.data as ChapterRelation;
    const existing = await findLivePair(this.db, storyId, relation.chapter1Id, relation.chapter2Id);
    if ((await this.resolveAgainstExisting(existing, new Date(relation.updatedAt))) === 'discard') {
      return;
    }

    await this.db.insert(schema.chapterRelations).values({
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

    const local = await this.db.query.chapterRelations.findFirst({
      where: eq(schema.chapterRelations.id, update.id),
    });
    if (!local) {
      console.warn(`ChapterRelation ${update.id} not found locally for update. Skipping.`);
      return;
    }

    const changes = update.changes as Partial<ChapterRelation>;
    const existing = await findLivePair(
      this.db,
      storyId,
      changes.chapter1Id || local.chapter1Id,
      changes.chapter2Id || local.chapter2Id,
      update.id,
    );
    const incomingUpdatedAt = changes.updatedAt ? new Date(changes.updatedAt) : new Date();
    if ((await this.resolveAgainstExisting(existing, incomingUpdatedAt)) === 'discard') {
      return;
    }

    await this.db
      .update(schema.chapterRelations)
      .set({
        ...changes,
        storyId,
        updatedAt: new Date(update.operationTime || new Date()),
        createdAt: changes.createdAt ? new Date(changes.createdAt) : undefined,
        deletedAt: changes.deletedAt ? new Date(changes.deletedAt) : undefined,
      })
      .where(eq(schema.chapterRelations.id, update.id));
  }

  async applyDelete(storyId: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;
    if (!update.id) {
      console.error(`Missing ID for delete operation on ${this.entityName} in story ${storyId}`);
      return;
    }

    await this.db
      .update(schema.chapterRelations)
      .set({ storyId, isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.chapterRelations.id, update.id));
  }

  async getById(id: string): Promise<ChapterRelation | undefined> {
    return this.db.query.chapterRelations.findFirst({
      where: eq(schema.chapterRelations.id, id),
    }) as Promise<ChapterRelation | undefined>;
  }
}
