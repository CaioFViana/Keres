import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export const storyPermissions = sqliteTable('story_permissions', {
  id: text('id').primaryKey(), // Added for consistency
  userId: text('user_id').notNull(),
  storyId: text('story_id').notNull(),
  serverId: text('server_id').notNull(),
  permission: text('permission').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(), // Added for consistency
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(), // Added for consistency
  deletedAt: integer('deleted_at', { mode: 'timestamp' }), // Added for consistency
});
export type StoryPermissionInsert = InferInsertModel<typeof storyPermissions>;
export type StoryPermissionSelect = InferSelectModel<typeof storyPermissions>;
