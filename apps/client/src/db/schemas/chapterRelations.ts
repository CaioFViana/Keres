import type { ChapterRelationType } from '@keres/shared';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * When two containers happened relative to each other.
 *
 * A different axis from `chapters.index`, which is narrative order - the order things are *told*.
 * Both ends are `chapters` rows, so one table covers event/event, event/chapter and chapter/chapter
 * with no polymorphism: an event is a chapter.
 */
export const chapterRelations = sqliteTable(
  'chapter_relations',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id').notNull(),
    chapter1Id: text('chapter1_id').notNull(),
    chapter2Id: text('chapter2_id').notNull(),
    relationType: text('relation_type').$type<ChapterRelationType>().notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    version: integer('version').notNull(),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  /*
   * One live statement per pair, whichever column each id sits in - the same shape as
   * `character_relations`. It does more than stop duplicates here: with one row per pair, "A before
   * B" and "B before A" cannot both exist, so a direct contradiction is unstorable. What remains is
   * the transitive kind, which is a cycle and belongs to the analysis.
   */
  (table) => [
    uniqueIndex('chapter_relation_pair_unique')
      .on(
        table.storyId,
        sql`MIN(${table.chapter1Id}, ${table.chapter2Id})`,
        sql`MAX(${table.chapter1Id}, ${table.chapter2Id})`,
      )
      .where(sql`${table.isDeleted} = 0`),
  ],
);
export type ChapterRelationInsert = InferInsertModel<typeof chapterRelations>;
export type ChapterRelationSelect = InferSelectModel<typeof chapterRelations>;
