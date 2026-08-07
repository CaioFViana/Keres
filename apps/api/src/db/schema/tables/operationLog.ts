import { relations } from 'drizzle-orm';
import { integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { stories } from './stories';
import { users } from './users';
import { operationTypeEnum } from '../enums';

export const operationLog = pgTable('operation_log', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => stories.id),
  userId: text('user_id').notNull().references(() => users.id),
  operationVersion: integer('operation_version').notNull(), // Unique per storyId
  operationType: operationTypeEnum('operation_type').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  payload: jsonb('payload').notNull(), // Store the data/changes as JSONB
  /**
   * Versão da *entidade* depois desta operação, distinta de `operationVersion` (que é a
   * posição da operação na sequência da história). Sem esta coluna o pull não tem como
   * informar a versão real da entidade e acaba mandando `operationVersion` no lugar -
   * um número muito maior, que faz a checagem de concorrência otimista do cliente passar
   * sempre e portanto nunca detectar conflito.
   *
   * Nulo nas linhas gravadas antes desta coluna existir.
   */
  entityVersion: integer('entity_version'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const operationLogRelations = relations(operationLog, ({ one }) => ({
  story: one(stories, {
    fields: [operationLog.storyId],
    references: [stories.id],
  }),
  user: one(users, {
    fields: [operationLog.userId],
    references: [users.id],
  }),
}));
