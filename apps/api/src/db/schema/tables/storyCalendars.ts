import type { CalendarDefinitionType } from '@keres/shared';
import { relations } from 'drizzle-orm';
import { boolean, integer, json, table, text, timestamp, timestampNow } from '../columns';
import { stories } from './stories';

/**
 * A calendar the story counts time in. See `StoryCalendarSchemas.ts` for why the whole definition
 * is one document rather than five child tables.
 */
export const storyCalendars = table('story_calendars', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => stories.id),
  name: text('name').notNull(),
  /** Service-enforced, not database-enforced - see the client table for why. */
  isPrimary: boolean('is_primary').notNull().default(false),
  description: text('description'),
  definition: json('definition').$type<CalendarDefinitionType>().notNull(),
  extraNotes: text('extra_notes'),
  createdAt: timestampNow('created_at'),
  updatedAt: timestampNow('updated_at'),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const storyCalendarsRelations = relations(storyCalendars, ({ one }) => ({
  story: one(stories, {
    fields: [storyCalendars.storyId],
    references: [stories.id],
  }),
}));
