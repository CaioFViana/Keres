import { boolean, integer, table, text, timestamp, timestampNow, unique } from '../columns';
import { stories } from './stories';
import { tags } from './tags';

export const tagRelations = table(
  'tag_relations',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id),
    relationId: text('relation_id').notNull(),
    relationType: text('relation_type').notNull(), // e.g., 'Character', 'Location', 'Scene'
    createdAt: timestampNow('created_at'),
    updatedAt: timestampNow('updated_at'),
    version: integer('version').notNull().default(1),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => {
    return {
      unq: unique('story_tag_relation_unq').on(
        table.storyId,
        table.tagId,
        table.relationId,
        table.relationType,
      ),
    };
  },
);
