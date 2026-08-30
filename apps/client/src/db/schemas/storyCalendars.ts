import type { CalendarDefinitionType } from '@keres/shared';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * A calendar the story counts time in.
 *
 * `definition` is `mode: 'json'` rather than plain text, unlike `packs.content` beside it. The
 * difference matters here because a calendar is a *synced* entity: `recordLocalOperation` serialises
 * the whole row into the operation-log payload, and a definition held as a string would arrive at
 * the server double-encoded, where the schema expects an object.
 *
 * `isPrimary` carries no database constraint. "Exactly one true per story" is not expressible as a
 * partial unique index without also forbidding zero, and a story mid-setup legitimately has none -
 * so the service owns the invariant and the reader picks deterministically (see
 * `StoryCalendarService`).
 */
export const storyCalendars = sqliteTable('story_calendars', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  name: text('name').notNull(),
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
  description: text('description'),
  definition: text('definition', { mode: 'json' }).$type<CalendarDefinitionType>().notNull(),
  extraNotes: text('extra_notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

export type StoryCalendarInsert = InferInsertModel<typeof storyCalendars>;
export type StoryCalendarSelect = InferSelectModel<typeof storyCalendars>;
