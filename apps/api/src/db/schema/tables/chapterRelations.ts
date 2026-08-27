import type { ChapterRelationType } from '@keres/shared';
import { boolean, integer, table, text, timestamp, timestampNow, unique } from '../columns';
import { chapters } from './chapters';
import { stories } from './stories';

/**
 * When two containers happened relative to each other.
 *
 * A different axis from `chapters.index`, which is narrative order - the order things are *told*.
 * Both ends are `chapters` rows, so one table covers event/event, event/chapter and chapter/chapter
 * with no polymorphism: an event is a chapter.
 *
 * The pair is unique, which does real work here rather than merely preventing duplicates: with one
 * statement per pair, "A before B" and "B before A" cannot both exist, so a direct contradiction is
 * impossible to store. Only transitive ones remain, and those are a cycle for the analysis to find.
 */
export const chapterRelations = table(
  'chapter_relations',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id),
    chapter1Id: text('chapter1_id')
      .notNull()
      .references(() => chapters.id),
    chapter2Id: text('chapter2_id')
      .notNull()
      .references(() => chapters.id),
    relationType: text('relation_type').$type<ChapterRelationType>().notNull(),
    createdAt: timestampNow('created_at'),
    updatedAt: timestampNow('updated_at'),
    version: integer('version').notNull().default(1),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => {
    return {
      unq: unique('story_chapter1_chapter2_unq').on(
        table.storyId,
        table.chapter1Id,
        table.chapter2Id,
      ),
    };
  },
);
