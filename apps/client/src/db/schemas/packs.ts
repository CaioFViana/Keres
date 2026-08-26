import type { PackVisibility } from '@keres/shared';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * A pack: the reusable part of a story's structure, applied to a new story at creation.
 *
 * Deliberately **not** a row in `stories` with a fake id. A sentinel story would have to be excluded
 * from the story list, the picker, tier counting, the sync engine's queries, favourites, publication
 * and export - a filter to remember in every one of those places forever, failing silently by
 * showing somebody a story that is not a story.
 *
 * Outside the synchronization engine entirely, like `friendships` and `storyPublications`: nothing
 * here enters the operation log and there is no sync handler. Sharing a pack is ordinary REST
 * against the server's own `packs` table - a pack is one row, with no sync state to agree about,
 * unlike a story publication which requires the story to be fully synchronized first.
 */
export const packs = sqliteTable('packs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  /**
   * Copied from the source story's `language`, editable afterwards. Free text, never translated: it
   * is the author's word, like a story title. The listing shows it instead of a language selector.
   */
  language: text('language'),
  /** Copied from the source story's `author`, editable. Display only. */
  authorName: text('author_name'),
  /** Bumped on each re-extraction. Not OCC - a pack never synchronizes field by field. */
  version: integer('version').notNull().default(1),
  /** What was asked of the server the last time this pack was shared. Private by default. */
  visibility: text('visibility').$type<PackVisibility>().notNull().default('private'),
  /** The whole `PackContentSchema` payload as JSON. It only ever moves as a whole. */
  content: text('content').notNull(),
  /**
   * The story it was extracted from, when that story still exists on this device. Only used to
   * offer "extract again"; a pack is a snapshot and must outlive its source, so nothing else may
   * depend on this being set.
   */
  sourceStoryId: text('source_story_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export type PackSelect = typeof packs.$inferSelect;
export type PackInsert = typeof packs.$inferInsert;
