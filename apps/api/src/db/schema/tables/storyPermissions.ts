import { relations } from 'drizzle-orm';
import { boolean, integer, table, text, timestamp, timestampNow } from '../columns';
import { stories } from './stories';
import { users } from './users';
import { storyPermissionTypeEnum } from '../enums';

export const storyPermissions = table('story_permissions', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => stories.id),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  permissionType: storyPermissionTypeEnum('permission_type').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: timestampNow('created_at'),
  updatedAt: timestampNow('updated_at'),
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
