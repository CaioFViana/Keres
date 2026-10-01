import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { servers } from './servers';

/**
 * Local copy of the open story invitations on each server, like `friendships`: what was last seen
 * stays visible offline, and a sync replaces a server's rows with the server's answer. `storyId` has
 * no foreign key - an invitation received is for a story this device does not have yet.
 */
export const storyInvitations = sqliteTable('story_invitations', {
  id: text('id').primaryKey(), // ULID, the server's
  serverId: text('server_id')
    .notNull()
    .references(() => servers.id),
  storyId: text('story_id').notNull(),
  storyTitle: text('story_title').notNull(),
  inviterId: text('inviter_id').notNull(),
  inviterUsername: text('inviter_username').notNull(),
  inviteeId: text('invitee_id').notNull(),
  inviteeUsername: text('invitee_username').notNull(),
  permissionType: text('permission_type', { enum: ['reader', 'writer'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type StoryInvitationInsert = InferInsertModel<typeof storyInvitations>;
export type StoryInvitationSelect = InferSelectModel<typeof storyInvitations>;
