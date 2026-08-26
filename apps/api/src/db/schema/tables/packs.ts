import { relations } from 'drizzle-orm';
import type { PackContentType, PackVisibility } from '@keres/shared';
import { index, integer, json, table, text, timestampNow } from '../columns';
import { users } from './users';

/**
 * A shared pack: the reusable part of a story's structure, offered for others to start a story with.
 *
 * Sharing a pack is **not** publishing a story, and deliberately does not reuse that machinery. A
 * publication exists because a story has to be fully synchronized first - the server must already
 * hold every entity before a snapshot means anything, which is why the client checks its operation
 * counter against the server's and refuses when they differ. A pack is one row with one JSON
 * payload; there is no sync state to agree about, so it travels over ordinary REST.
 *
 * Consequently: no `version` for optimistic concurrency, no `isDeleted` tombstone, no handler in
 * `entity-sync-handlers/`, no entry in the operation log. Deletion is physical.
 *
 * The metadata is in columns rather than inside `content` so that listing never parses a payload.
 * `version` here is the pack's own, bumped by its author on each re-extraction - a pack at a given
 * version is immutable.
 */
export const packs = table(
  'packs',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    description: text('description'),
    /**
     * The raw string the author copied from the source story, editable by them. Free text and never
     * translated: the listing shows it instead of offering a language filter.
     */
    language: text('language'),
    authorName: text('author_name'),
    version: integer('version').notNull().default(1),
    /**
     * Offered on the public Showcase, or shared with this server only. Private by default: uploading
     * reaches your own devices and collaborators, which is not the same as publishing to a page.
     */
    visibility: text('visibility').$type<PackVisibility>().notNull().default('private'),
    /** The whole `PackContentSchema` payload. It only ever moves as a whole. */
    content: json('content').$type<PackContentType>().notNull(),
    createdAt: timestampNow('created_at'),
    updatedAt: timestampNow('updated_at'),
  },
  (table) => [
    index('pack_owner_idx').on(table.ownerId),
    // The public listing filters on this and nothing else.
    index('pack_visibility_idx').on(table.visibility),
  ],
);

export const packsRelations = relations(packs, ({ one }) => ({
  owner: one(users, { fields: [packs.ownerId], references: [users.id] }),
}));
