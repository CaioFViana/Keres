import { MESSAGE_CHANNELS } from '@keres/shared/metadata/MessageLimits';
import { dbEnum, index, table, text, timestamp, timestampNow } from '../columns';
import { users } from './users';

export const messageChannelEnum = dbEnum('message_channel', MESSAGE_CHANNELS);

/**
 * Every message the server carries, in one table: what visitors write in the landing page form
 * (`site`), the conversations between a user and the administrators (`admin`, either direction) and
 * the ones between two friends (`direct`).
 *
 * "Administrators" are not a user: when `senderId` is null on an `admin` message an administrator
 * wrote it (`sentByAdminId` says which, for the admin panel only - the user sees "Administrators"),
 * and when `recipientId` is null it is addressed to them. A `site` message has no user on either side.
 *
 * Each side deletes for itself: `senderDeletedAt` / `recipientDeletedAt` hide the row from that side
 * only, and the row is physically removed once both sides are gone (`MessageService`). A side that
 * never existed counts as gone - a site message is born with `senderDeletedAt` set - so the
 * administrators deleting one is enough to drop it.
 *
 * Reading is tracked for the administrators' side only (`adminReadAt`): users never learn whether
 * their message was read. `adminArchivedAt` moves it out of the default inbox view.
 */
export const messages = table(
  'messages',
  {
    id: text('id').primaryKey(),
    channel: messageChannelEnum('channel').notNull(),
    senderId: text('sender_id').references(() => users.id, { onDelete: 'cascade' }),
    recipientId: text('recipient_id').references(() => users.id, { onDelete: 'cascade' }),
    /** The administrator who wrote an `admin` reply; audit for the admin panel, never shown to users. */
    sentByAdminId: text('sent_by_admin_id').references(() => users.id, { onDelete: 'set null' }),
    /** Landing page form only. */
    subject: text('subject'),
    body: text('body').notNull(),
    /** Landing page form only: the visitor's address, since there is no account to reply to. */
    contactEmail: text('contact_email'),
    createdAt: timestampNow('created_at'),
    senderDeletedAt: timestamp('sender_deleted_at'),
    recipientDeletedAt: timestamp('recipient_deleted_at'),
    adminReadAt: timestamp('admin_read_at'),
    adminArchivedAt: timestamp('admin_archived_at'),
  },
  (table) => [
    index('messages_recipient_idx').on(table.recipientId, table.createdAt),
    index('messages_sender_idx').on(table.senderId, table.createdAt),
    index('messages_channel_idx').on(table.channel, table.createdAt),
  ],
);
