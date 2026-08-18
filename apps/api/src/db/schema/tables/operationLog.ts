import { relations } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { stories } from './stories';
import { users } from './users';
import { operationTypeEnum } from '../enums';

export const operationLog = pgTable(
  'operation_log',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
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
  },
  (table) => [
    /**
     * Rede de segurança para o contador atômico em `stories.lastOperationVersion`: se algum
     * caminho algum dia inserir sem passar por `SyncService.appendOperationLog` (ou se o
     * contador for calculado errado), o banco recusa a duplicata em vez de aceitá-la em
     * silêncio - o que antes fazia uma das duas operações ficar invisível para sempre no
     * `pull` incremental de outros colaboradores (o filtro usa `operation_version > cursor`).
     */
    uniqueIndex('operation_log_story_id_operation_version_idx').on(
      table.storyId,
      table.operationVersion,
    ),
    // AdminRecoveryService.browseOperationLog filters/sorts by exactly these columns, in any
    // combination - without these, every filter besides storyId (already covered by the
    // unique index above as a prefix) falls back to a full table scan as the log grows.
    index('operation_log_created_at_idx').on(table.createdAt),
    index('operation_log_user_id_idx').on(table.userId),
    index('operation_log_entity_type_idx').on(table.entityType),
    index('operation_log_operation_type_idx').on(table.operationType),
  ],
);

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
