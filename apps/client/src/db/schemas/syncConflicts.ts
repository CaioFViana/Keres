import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Conflitos de sincronização aguardando decisão do usuário.
 *
 * Um conflito é por *entidade*, não por operação: se o usuário editou o mesmo capítulo
 * cinco vezes offline e o servidor recusou a primeira dessas edições, as cinco estão na
 * mesma situação e apresentá-las separadamente só multiplicaria a decisão. Os ids das
 * operações envolvidas ficam em `localOperationIds`.
 *
 * A tabela é a razão de o cliente não perder mais o trabalho feito offline: enquanto o
 * conflito está `pending`, as operações locais correspondentes ficam marcadas em
 * `operation_logs.conflictState` e não são reenviadas nem descartadas.
 */
export const syncConflicts = sqliteTable('sync_conflicts', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  /** Um dos valores de `SyncConflictReason` no pacote compartilhado. */
  reason: text('reason').notNull(),
  /** O que o usuário fez localmente e que ainda não passou. */
  localOperationType: text('local_operation_type', { enum: ['create', 'update', 'delete', 'reorder'] }).notNull(),
  /** JSON: ids das linhas de `operation_logs` agrupadas neste conflito. */
  localOperationIds: text('local_operation_ids').notNull(),
  /** JSON: os valores que o usuário quer preservar. */
  localValues: text('local_values').notNull(),
  /** JSON: o estado da entidade no servidor, para o comparativo lado a lado. */
  serverValues: text('server_values'),
  /** Versão base sobre a qual o usuário editou. */
  clientVersion: integer('client_version'),
  /** Versão que o servidor tem agora. */
  serverVersion: integer('server_version'),
  /** Mensagem técnica de origem, para diagnóstico. A tela usa `reason`. */
  message: text('message'),
  status: text('status', { enum: ['pending', 'resolved', 'dismissed'] }).notNull().default('pending'),
  resolution: text('resolution', { enum: ['keep_local', 'keep_server', 'merge', 'restore', 'discard'] }),
  detectedAt: integer('detected_at', { mode: 'timestamp' }).notNull(),
  resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
});

export type SyncConflictInsert = InferInsertModel<typeof syncConflicts>;
export type SyncConflictSelect = InferSelectModel<typeof syncConflicts>;
