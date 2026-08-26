import { relations } from 'drizzle-orm';
import { table, text, timestampNow } from '../columns';
import { showcaseVisibilityEnum, publicationLabelModeEnum } from '../enums';
import { stories } from './stories';
import { storyPublications } from './storyPublications';
import { users } from './users';

/**
 * A story that is published on the Showcase, right now.
 *
 * Separate from `story_publications` because what it holds is not per version: visibility and password
 * apply to the whole story, and changing the password must not invent a new version. The row's
 * existence *is* "it is published": unpublishing deletes this row and every version in the same
 * transaction, so an orphaned version is not a reachable state.
 */
export const storyShowcaseEntries = table('story_showcase_entries', {
  storyId: text('story_id')
    .primaryKey()
    .references(() => stories.id),
  ownerUserId: text('owner_user_id')
    .notNull()
    .references(() => users.id),
  visibility: showcaseVisibilityEnum('visibility').notNull().default('public'),
  /**
   * bcrypt, `null` while `visibility = 'public'`. A shared secret, not per-person access control: it
   * serves to keep a story out of the listing and to make a leaked link insufficient on its own. Whoever
   * has the password can pass it on, and that is accepted.
   */
  passwordHash: text('password_hash'),
  /** The last naming style the owner used, only so the app comes up already marked with the right style. */
  labelMode: publicationLabelModeEnum('label_mode').notNull().default('both'),
  createdAt: timestampNow('created_at'),
  /** It moves on every publication/removal - it is what the public listing's ETag comes from. */
  updatedAt: timestampNow('updated_at'),
});

export const storyShowcaseEntriesRelations = relations(storyShowcaseEntries, ({ one, many }) => ({
  story: one(stories, {
    fields: [storyShowcaseEntries.storyId],
    references: [stories.id],
  }),
  owner: one(users, {
    fields: [storyShowcaseEntries.ownerUserId],
    references: [users.id],
  }),
  publications: many(storyPublications),
}));
