import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export const operationLogs = sqliteTable('operation_logs', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  userId: text('user_id').notNull(),
  operationVersion: integer('operation_version').notNull(), // Unique per storyId
  operationType: text('operation_type', { enum: ['create', 'update', 'delete', 'reorder'] }).notNull(), // Add 'reorder'
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  payload: text('payload').notNull(), // Stored as JSON string
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  isSynced: integer('is_synced', { mode: 'boolean' }).notNull().default(false), // Add isSynced
  serverOperationVersion: integer('server_operation_version').default(0), // Add serverOperationVersion
});
export type OperationLogInsert = InferInsertModel<typeof operationLogs>;
export type OperationLogSelect = InferSelectModel<typeof operationLogs>;
