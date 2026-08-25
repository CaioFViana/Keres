import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { servers } from './servers';

/**
 * A local mirror of a story's public versions (Showcase).
 *
 * Deliberately outside the synchronization engine - like `friendships`: nothing here enters the
 * operation log nor has a sync handler. The table exists for two reasons, and only those:
 *   1. the publication screen lists the versions without needing the network on every opening;
 *   2. it is the comparison basis that reveals what was published while this device was
 *      offline - the server warns over WebSocket, but its bus is in memory and does not
 *      redeliver anything, so the app redoes the GET on every reconnection and compares with what it had.
 */
export const storyPublications = sqliteTable(
  'story_publications',
  {
    /** O mesmo id do servidor - estas linhas nunca nascem locais. */
    id: text('id').primaryKey(),
    serverId: text('server_id')
      .notNull()
      .references(() => servers.id),
    storyId: text('story_id').notNull(),
    label: text('label').notNull(),
    operationVersion: integer('operation_version').notNull(),
    byteSize: integer('byte_size').notNull(),
    /** The instant of publication on the server, not of when this device found out about it. */
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    /**
     * False while the person has not been told yet. Without this, the first synchronization after
     * installing the app would fire a warning for every version that already existed.
     */
    notified: integer('notified', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [unique('publication_server_unq').on(table.serverId, table.id)],
);

export type StoryPublicationInsert = InferInsertModel<typeof storyPublications>;
export type StoryPublicationSelect = InferSelectModel<typeof storyPublications>;
