import { sql } from 'drizzle-orm';
import { boolean, integer, table, text, timestamp, timestampNow, uniqueIndex } from '../columns';
import { stories } from './stories';

export const tags = table(
  'tags',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id),
    name: text('name').notNull(),
    color: text('color'),
    isFavorite: boolean('is_favorite').notNull().default(false),
    extraNotes: text('extra_notes'),
    createdAt: timestampNow('created_at'),
    updatedAt: timestampNow('updated_at'),
    version: integer('version').notNull().default(1),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => {
    return {
      unq: uniqueIndex('story_name_unq')
        .on(table.storyId, table.name)
        .where(sql`${table.isDeleted} = false`),
    };
  },
);
