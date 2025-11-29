import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export const operationLogs = sqliteTable('operation_logs', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  userId: text('user_id').notNull(),
  operationVersion: integer('operation_version').notNull(), // Unique per storyId
  operationType: text('operation_type', { enum: ['create', 'update', 'delete'] }).notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  payload: text('payload').notNull(), // Stored as JSON string
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
export type OperationLogInsert = InferInsertModel<typeof operationLogs>;
export type OperationLogSelect = InferSelectModel<typeof operationLogs>;
