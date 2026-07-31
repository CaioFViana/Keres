import { relations, sql } from 'drizzle-orm';
import { boolean, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { operationLog } from './operationLog';
import { stories } from './stories';
import { storyPermissions } from './storyPermissions';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  /**
   * Freely-changeable handle used for friend discovery (e.g. "@caio"), distinct from
   * `username` which is the login credential and can't be casually renamed. Uniqueness
   * is enforced case-insensitively via the index below, since "Caio" and "caio" being
   * two different addressable friends would be confusing.
   */
  tag: text('tag').notNull(),
  password: text('password').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
}, (table) => [
  uniqueIndex('users_tag_lower_idx').on(sql`lower(${table.tag})`),
]);

export const usersRelations = relations(users, ({ many }) => ({
  stories: many(stories),
  storyPermissions: many(storyPermissions),
  operationLogs: many(operationLog),
}));
