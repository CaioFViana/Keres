import { index, table, text, timestampNow } from '../columns';

/**
 * One row per version a user published, kept only long enough to count "publications per day".
 *
 * It is not `story_publications`: those rows go away when a version is deleted or pruned (a story
 * keeps five), and a daily ceiling that deleting a version resets would not limit anything - the
 * cost of a publication (packaging, compiling) is paid whether or not the version stays. No foreign
 * keys, so it outlives a story or a user; rows older than two days are dropped as new ones arrive.
 */
export const publicationLog = table(
  'publication_log',
  {
    id: text('id').primaryKey(),
    /** The publisher whose plan the publication counts against. */
    userId: text('user_id').notNull(),
    storyId: text('story_id').notNull(),
    createdAt: timestampNow('created_at'),
  },
  (table) => [
    index('publication_log_user_idx').on(table.userId, table.createdAt),
    index('publication_log_created_idx').on(table.createdAt),
  ],
);
