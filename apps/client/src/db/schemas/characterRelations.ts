import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const characterRelations = sqliteTable(
  'character_relations',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id').notNull(),
    character1Id: text('character1_id').notNull(),
    character2Id: text('character2_id').notNull(),
    relationType: text('relation_type').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    version: integer('version').notNull(),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  // One relation per pair of characters, whichever column each id sits in - the same rule
  // `CharacterRelationService` checks before writing, now also enforced by the database, so a bulk
  // import cannot get around it. See migration 0015.
  (table) => [
    uniqueIndex('character_relation_pair_unique')
      .on(
        table.storyId,
        sql`MIN(${table.character1Id}, ${table.character2Id})`,
        sql`MAX(${table.character1Id}, ${table.character2Id})`,
      )
      .where(sql`${table.isDeleted} = 0`),
  ],
);
export type CharacterRelationInsert = InferInsertModel<typeof characterRelations>;
export type CharacterRelationSelect = InferSelectModel<typeof characterRelations>;
