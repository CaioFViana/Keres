import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Synchronization conflicts awaiting the user's decision.
 *
 * A conflict is per *entity*, not per operation: if the user edited the same chapter five times offline
 * and the server refused the first of those edits, all five are in the same situation and presenting
 * them separately would only multiply the decision. The ids of the operations involved live in
 * `localOperationIds`.
 *
 * This table is the reason the client no longer loses work done offline: while the conflict is
 * `pending`, the corresponding local operations stay marked in `operation_logs.conflictState` and are
 * neither resent nor discarded.
 */
export const syncConflicts = sqliteTable('sync_conflicts', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  /** Um dos valores de `SyncConflictReason` no pacote compartilhado. */
  reason: text('reason').notNull(),
  /** What the user did locally and has not gone through yet. */
  localOperationType: text('local_operation_type', {
    enum: ['create', 'update', 'delete', 'reorder'],
  }).notNull(),
  /** JSON: the ids of the `operation_logs` rows grouped in this conflict. */
  localOperationIds: text('local_operation_ids').notNull(),
  /** JSON: the values the user wants to keep. */
  localValues: text('local_values').notNull(),
  /** JSON: o estado da entidade no servidor, para o comparativo lado a lado. */
  serverValues: text('server_values'),
  /** The base version the user edited on top of. */
  clientVersion: integer('client_version'),
  /** The version the server holds now. */
  serverVersion: integer('server_version'),
  /** The originating technical message, for diagnosis. The screen uses `reason`. */
  message: text('message'),
  status: text('status', { enum: ['pending', 'resolved', 'dismissed'] })
    .notNull()
    .default('pending'),
  resolution: text('resolution', {
    enum: ['keep_local', 'keep_server', 'merge', 'restore', 'discard'],
  }),
  detectedAt: integer('detected_at', { mode: 'timestamp' }).notNull(),
  resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
});

export type SyncConflictInsert = InferInsertModel<typeof syncConflicts>;
export type SyncConflictSelect = InferSelectModel<typeof syncConflicts>;
