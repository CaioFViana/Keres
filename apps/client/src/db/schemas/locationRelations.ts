import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { LocationRelationType } from '@keres/shared';

export const locationRelations = sqliteTable(
  'location_relations',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id').notNull(),
    locationAId: text('location_a_id').notNull(),
    locationBId: text('location_b_id').notNull(),
    relationType: text('relation_type').$type<LocationRelationType>().notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    version: integer('version').notNull(),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  // Unordered pair, scoped by type: "contains" and "connected_to" between the same two places are
  // two different statements, as on the server. See migration 0015.
  (table) => [
    uniqueIndex('location_relation_pair_unique')
      .on(
        table.storyId,
        sql`MIN(${table.locationAId}, ${table.locationBId})`,
        sql`MAX(${table.locationAId}, ${table.locationBId})`,
        table.relationType,
      )
      .where(sql`${table.isDeleted} = 0`),
  ],
);
export type LocationRelationInsert = InferInsertModel<typeof locationRelations>;
export type LocationRelationSelect = InferSelectModel<typeof locationRelations>;
