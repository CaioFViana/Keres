import type { ChapterRelationType } from '@keres/shared';
import { and, eq, ne, or, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { ChapterRelationInsert, ChapterRelationSelect } from '../../db/schema';
import { chapterRelations } from '../../db/schema';
import type { Create } from '../../utils/entityUtils';
import { getChangedFields, prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperation,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

/**
 * The story's chronology: when its containers happened relative to each other.
 *
 * A different axis from `chapters.index`, which is the order things are *told*. Both ends are
 * `chapters` rows, so one service covers event/event, event/chapter and chapter/chapter.
 *
 * **The two ids are a sequence, not a pair.** `before` and `during` are directional, so unlike
 * `CharacterRelationService` this one never sorts them - sorting would reverse half of what a writer
 * says. Uniqueness is still on the unordered pair, checked in both directions here and enforced by a
 * partial unique index on the table. That is what makes "A before B" and "B before A" impossible to
 * hold at once, leaving only transitive contradictions, which are cycles for the analysis to report.
 */

export interface ChapterRelationService {
  getRelationsForStory(storyId: string): Promise<ChapterRelationSelect[]>;
  getRelationsForChapter(chapterId: string): Promise<ChapterRelationSelect[]>;
  getById(relationId: string): Promise<ChapterRelationSelect | undefined>;
  createRelation(
    currentUserId: string,
    data: Create<ChapterRelationInsert>,
  ): Promise<ChapterRelationSelect>;
  updateRelation(
    currentUserId: string,
    relationId: string,
    changes: { chapter1Id?: string; chapter2Id?: string; relationType?: ChapterRelationType },
  ): Promise<ChapterRelationSelect>;
  deleteRelation(currentUserId: string, relationId: string): Promise<void>;
}

/** A live statement about this pair, whichever way round it was written. */
function livePairCondition(storyId: string, chapter1Id: string, chapter2Id: string) {
  return and(
    eq(chapterRelations.storyId, storyId),
    eq(chapterRelations.isDeleted, false),
    or(
      and(eq(chapterRelations.chapter1Id, chapter1Id), eq(chapterRelations.chapter2Id, chapter2Id)),
      and(eq(chapterRelations.chapter1Id, chapter2Id), eq(chapterRelations.chapter2Id, chapter1Id)),
    ),
  );
}

export const createChapterRelationService = (db: AppDrizzleClient): ChapterRelationService => {
  const serverService = createServerService(db);

  const assertPairIsFree = async (
    storyId: string,
    chapter1Id: string,
    chapter2Id: string,
    excludeId?: string,
  ) => {
    if (chapter1Id === chapter2Id) {
      throw new Error('A container cannot be related to itself.');
    }
    const conditions = [livePairCondition(storyId, chapter1Id, chapter2Id)];
    if (excludeId) conditions.push(ne(chapterRelations.id, excludeId));
    const existing = await db.query.chapterRelations.findFirst({ where: and(...conditions) });
    if (existing) {
      throw new Error(
        'These two containers already have a chronology relation. Two of them hold one statement ' +
          'about their order, in one direction or the other.',
      );
    }
  };

  return {
    async getRelationsForStory(storyId) {
      return db
        .select()
        .from(chapterRelations)
        .where(and(eq(chapterRelations.storyId, storyId), eq(chapterRelations.isDeleted, false)))
        .all();
    },

    async getRelationsForChapter(chapterId) {
      return db
        .select()
        .from(chapterRelations)
        .where(
          and(
            eq(chapterRelations.isDeleted, false),
            or(
              eq(chapterRelations.chapter1Id, chapterId),
              eq(chapterRelations.chapter2Id, chapterId),
            ),
          ),
        )
        .all();
    },

    async getById(relationId) {
      return db.query.chapterRelations.findFirst({
        where: and(eq(chapterRelations.id, relationId), eq(chapterRelations.isDeleted, false)),
      });
    },

    async createRelation(currentUserId, data) {
      await assertStoryIsWritable(db, data.storyId);
      await assertPairIsFree(data.storyId, data.chapter1Id, data.chapter2Id);

      const newRelation = prepareNewEntityData<ChapterRelationInsert>(data);
      const result = await db.insert(chapterRelations).values(newRelation).returning().get();

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        newRelation.storyId,
        currentUserId,
      );
      await recordLocalOperation(
        db,
        newRelation.storyId,
        userIdToLog,
        'create',
        'ChapterRelation',
        newRelation.id,
        { ...result },
      );
      entityEventEmitter.emit('chapter_relation_changed', newRelation.storyId, newRelation.id);
      return result;
    },

    async updateRelation(currentUserId, relationId, changes) {
      const original = await db.query.chapterRelations.findFirst({
        where: eq(chapterRelations.id, relationId),
      });
      if (!original) {
        throw new Error(`ChapterRelation with ID ${relationId} not found for update.`);
      }
      await assertStoryIsWritable(db, original.storyId);

      if (changes.chapter1Id || changes.chapter2Id) {
        await assertPairIsFree(
          original.storyId,
          changes.chapter1Id ?? original.chapter1Id,
          changes.chapter2Id ?? original.chapter2Id,
          relationId,
        );
      }

      const potentialNewState = { ...original, ...changes };
      const changed = getChangedFields(original, potentialNewState);
      delete changed.version;
      delete changed.updatedAt;
      if (Object.keys(changed).length === 0) return original;

      await db
        .update(chapterRelations)
        .set({ ...changes, updatedAt: new Date(), version: sql`${chapterRelations.version} + 1` })
        .where(eq(chapterRelations.id, relationId));

      const updated = await db.query.chapterRelations.findFirst({
        where: eq(chapterRelations.id, relationId),
      });
      if (!updated) throw new Error(`Failed to retrieve updated ChapterRelation ${relationId}.`);

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        updated.storyId,
        currentUserId,
      );
      await recordLocalOperation(
        db,
        updated.storyId,
        userIdToLog,
        'update',
        'ChapterRelation',
        relationId,
        getChangedFields(original, updated),
      );
      entityEventEmitter.emit('chapter_relation_changed', updated.storyId, relationId);
      return updated;
    },

    async deleteRelation(currentUserId, relationId) {
      const relation = await db.query.chapterRelations.findFirst({
        where: eq(chapterRelations.id, relationId),
      });
      if (!relation) {
        console.warn(`Attempted to delete non-existent ChapterRelation ${relationId}.`);
        return;
      }
      await assertStoryIsWritable(db, relation.storyId);

      const [updated] = await db
        .update(chapterRelations)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
          version: sql`${chapterRelations.version} + 1`,
        })
        .where(eq(chapterRelations.id, relationId))
        .returning({
          id: chapterRelations.id,
          storyId: chapterRelations.storyId,
          isDeleted: chapterRelations.isDeleted,
          version: chapterRelations.version,
        });
      if (!updated) throw new Error(`Failed to delete ChapterRelation ${relationId}.`);

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        updated.storyId,
        currentUserId,
      );
      await recordLocalOperation(
        db,
        updated.storyId,
        userIdToLog,
        'delete',
        'ChapterRelation',
        relationId,
        { id: updated.id, isDeleted: updated.isDeleted, version: updated.version },
      );
      entityEventEmitter.emit('chapter_relation_changed', updated.storyId, relationId);
    },
  };
};
