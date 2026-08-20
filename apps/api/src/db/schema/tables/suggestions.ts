import { boolean, integer, table, text, timestamp, timestampNow, unique } from '../columns';
import { stories } from './stories';

export const suggestions = table(
  'suggestions',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id),
    type: text('type').notNull(),
    value: text('value').notNull(),
    createdAt: timestampNow('created_at'),
    updatedAt: timestampNow('updated_at'),
    version: integer('version').notNull().default(1),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => {
    return {
      unq: unique('story_suggestion_type_value_unq').on(table.storyId, table.type, table.value),
    };
  },
);
