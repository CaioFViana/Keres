import { relations } from 'drizzle-orm';
import { boolean, integer, table, text, timestamp, timestampNow, unique } from '../columns';
import { stories } from './stories';
import { storySchemaFields } from './storySchemaFields';

export const attributeValues = table(
  'attribute_values',
  {
    id: text('id').primaryKey(),
    // Denormalizado do campo, para consultas/índices sem join - mesmo padrão de outras tabelas.
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id),
    entityType: text('entity_type').notNull(),
    // FK polimórfica (characters.id/locations.id/etc conforme entityType) - mesmo padrão de
    // NoteRelation.relationId/TagRelation.relationId, sem FK de banco de dados de fato.
    entityId: text('entity_id').notNull(),
    fieldId: text('field_id')
      .notNull()
      .references(() => storySchemaFields.id),
    value: text('value'),
    createdAt: timestampNow('created_at'),
    updatedAt: timestampNow('updated_at'),
    version: integer('version').notNull().default(1),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => {
    return {
      unq: unique('entity_field_unq').on(table.entityId, table.fieldId),
    };
  },
);

export const attributeValuesRelations = relations(attributeValues, ({ one }) => ({
  story: one(stories, {
    fields: [attributeValues.storyId],
    references: [stories.id],
  }),
  field: one(storySchemaFields, {
    fields: [attributeValues.fieldId],
    references: [storySchemaFields.id],
  }),
}));
