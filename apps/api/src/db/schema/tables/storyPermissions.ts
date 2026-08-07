import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { stories } from './stories';
import { users } from './users';
import { storyPermissionTypeEnum } from '../enums';

export const storyPermissions = pgTable('story_permissions', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => stories.id),
  userId: text('user_id').notNull().references(() => users.id),
  permissionType: storyPermissionTypeEnum('permission_type').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const storyPermissionsRelations = relations(storyPermissions, ({ one }) => ({
  story: one(stories, {
    fields: [storyPermissions.storyId],
    references: [stories.id],
  }),
  user: one(users, {
    fields: [storyPermissions.userId],
    references: [users.id],
  }),
}));
