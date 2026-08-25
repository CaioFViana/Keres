import { relations } from 'drizzle-orm';
import { bigintNumber, index, integer, json, table, text, timestampNow, unique } from '../columns';
import type { StoryPublicationSnapshot } from '@keres/shared';
import { stories } from './stories';
import { users } from './users';

/**
 * A public version of a story: the immutable .zip the Showcase offers for download.
 *
 * Deliberately outside the synchronization engine - no `version`, no `isDeleted`, no handler in
 * `entity-sync-handlers/`, no entry in the operation log. Publishing is not an edit of the story; it
 * is a parallel object, tracked the same way `friendships` already is. That is why deletion here is
 * physical (the row goes away along with the blob), not a tombstone for sync to propagate.
 *
 * `snapshot` is a copy, not a join, on purpose: the site describes the story as it stood in that
 * version. If the author renames the story tomorrow, the published version keeps announcing the name it
 * was published under.
 */
export const storyPublications = table(
  'story_publications',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id),
    /** The owner at the moment of publication. A copy of `stories.userId`, so the site does not depend on a join. */
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => users.id),
    /** The version's name, in the style the owner chose (see `buildPublicationLabel`). */
    label: text('label').notNull(),
    /** `stories.lastOperationVersion` at the instant of publication. */
    operationVersion: integer('operation_version').notNull(),
    /** `CURRENT_STORY_FORMAT_VERSION` at the instant of publication. */
    formatVersion: integer('format_version').notNull(),
    /** `bigint` because a package with a gallery comfortably exceeds 2 GB at the theoretical limit. */
    byteSize: bigintNumber('byte_size').notNull(),
    mediaIncluded: integer('media_included').notNull().default(0),
    mediaTotal: integer('media_total').notNull().default(0),
    snapshot: json('snapshot').$type<StoryPublicationSnapshot>().notNull(),
    createdAt: timestampNow('created_at'),
  },
  (table) => [
    unique('story_publication_label_unq').on(table.storyId, table.label),
    index('story_publication_story_idx').on(table.storyId),
  ],
);

export const storyPublicationsRelations = relations(storyPublications, ({ one }) => ({
  story: one(stories, {
    fields: [storyPublications.storyId],
    references: [stories.id],
  }),
  owner: one(users, {
    fields: [storyPublications.ownerUserId],
    references: [users.id],
  }),
}));
