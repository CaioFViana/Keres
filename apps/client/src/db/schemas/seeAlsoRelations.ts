import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

export const seeAlsoRelations = sqliteTable('see_also_relations', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  entityAType: text('entity_a_type').notNull(),
  entityAId: text('entity_a_id').notNull(),
  entityBType: text('entity_b_type').notNull(),
  entityBId: text('entity_b_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
}, (table) => [
  // Só protege contra duplicatas se A/B forem sempre canonicalizados (ordenados) antes do
  // insert - ver SeeAlsoRelationService.sortEntityRefs.
  unique('see_also_story_a_b_unq').on(
    table.storyId,
    table.entityAType,
    table.entityAId,
    table.entityBType,
    table.entityBId,
  ),
]);

export type SeeAlsoRelationInsert = InferInsertModel<typeof seeAlsoRelations>;
export type SeeAlsoRelationSelect = InferSelectModel<typeof seeAlsoRelations>;
