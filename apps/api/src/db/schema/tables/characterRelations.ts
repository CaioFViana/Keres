import { boolean, integer, table, text, timestamp, timestampNow, unique } from '../columns';
import { characters } from './characters';
import { stories } from './stories';

export const characterRelations = table(
  'character_relations',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id),
    character1Id: text('character1_id')
      .notNull()
      .references(() => characters.id),
    character2Id: text('character2_id')
      .notNull()
      .references(() => characters.id),
    relationType: text('relation_type').notNull(),
    createdAt: timestampNow('created_at'),
    updatedAt: timestampNow('updated_at'),
    version: integer('version').notNull().default(1),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => {
    return {
      unq: unique('story_char1_char2_unq').on(
        table.storyId,
        table.character1Id,
        table.character2Id,
      ),
    };
  },
);
