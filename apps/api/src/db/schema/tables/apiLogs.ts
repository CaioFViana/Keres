import { desc, relations } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { apiLogLevelEnum } from '../enums';
import { stories } from './stories';
import { users } from './users';

/**
 * Persistência do que já passa por `utils/logger.ts` (erros tratados + eventos de
 * domínio) - nem toda linha tem `userId`/`storyId`, por isso ambos ficam nullable (ex:
 * eventos do sistema de amizades não pertencem a uma história).
 */
export const apiLogs = pgTable(
  'api_logs',
  {
    id: text('id').primaryKey(),
    level: apiLogLevelEnum('level').notNull(),
    message: text('message').notNull(),
    meta: jsonb('meta'),
    userId: text('user_id').references(() => users.id),
    storyId: text('story_id').references(() => stories.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    // Os quatro filtros que a tabela do admin oferece - sem estes índices, a paginação por
    // offset degrada num log que só cresce.
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
