import { desc, relations } from 'drizzle-orm';
import { index, json, table, text, timestampNow } from '../columns';
import { apiLogLevelEnum } from '../enums';
import { stories } from './stories';
import { users } from './users';

/**
 * Persistence for what already goes through `utils/logger.ts` (handled errors + domain events) - not
 * every row has a `userId`/`storyId`, which is why both are nullable (friendship system events, for
 * instance, do not belong to a story).
 *
 * Deliberately without a foreign key: a 401 on `/sync/:storyId/pull` records the id from the URL even
 * when the story does not exist on this server (a local client, an invalid token, a probe). A log is
 * an observation - an FK would make recording the rejection itself fail.
 */
export const apiLogs = table(
  'api_logs',
  {
    id: text('id').primaryKey(),
    level: apiLogLevelEnum('level').notNull(),
    message: text('message').notNull(),
    meta: json('meta'),
    userId: text('user_id'),
    storyId: text('story_id'),
    createdAt: timestampNow('created_at'),
  },
  (table) => [
    // The four filters the admin table offers - without these indexes, offset pagination degrades on a
    // log that only grows.
    index('api_logs_story_id_idx').on(table.storyId),
    index('api_logs_user_id_idx').on(table.userId),
    index('api_logs_created_at_idx').on(desc(table.createdAt)),
    index('api_logs_level_idx').on(table.level),
  ],
);

export const apiLogsRelations = relations(apiLogs, ({ one }) => ({
  story: one(stories, {
    fields: [apiLogs.storyId],
    references: [stories.id],
  }),
  user: one(users, {
    fields: [apiLogs.userId],
    references: [users.id],
  }),
}));
