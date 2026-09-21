import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

/**
 * Local-first journal of every mutation, and the source of what `SyncPush` sends.
 *
 * Each row records one create/update/delete/reorder with a per-story monotonic
 * `operationVersion` (sequenced against `stories.lastOperationLog`), so the push order
 * stays deterministic even when two writes share the same timestamp. Rows that arrived
 * from the server are recorded here too (`isSynced: true`) for history display.
 * This table is append-heavy by design: refused operations are parked via
 * `conflictState`, never deleted, until the user resolves them.
 */
export const operationLogs = sqliteTable('operation_logs', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  userId: text('user_id').notNull(),
  /** Strictly increasing within a story; defines the order operations are pushed in. */
  operationVersion: integer('operation_version').notNull(),
  operationType: text('operation_type', {
    enum: ['create', 'update', 'delete', 'reorder'],
  }).notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  /** JSON-encoded snapshot of the written fields, including the resulting `version`. */
  payload: text('payload').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  isSynced: integer('is_synced', { mode: 'boolean' }).notNull().default(false),
  /** The version the server assigned once accepted; also used to spot echoed-back ops. */
  serverOperationVersion: integer('server_operation_version').default(0),
  /**
   * Marks operations that must not go to the server in the current state.
   *
   * - `null`: a normal operation, it enters the next push.
   * - `'conflicted'`: the server refused it (or the pull detected a clash) and there is a pending
   *   conflict in `sync_conflicts`. It stays out of the push until the user decides, which avoids
   *   both losing the edit and resending it in a loop on every cycle.
   * - `'abandoned'`: the user resolved the conflict in a way that discards this
   *   operation. Preserved as history only.
   */
  conflictState: text('conflict_state', { enum: ['conflicted', 'abandoned'] }),
});
export type OperationLogInsert = InferInsertModel<typeof operationLogs>;
export type OperationLogSelect = InferSelectModel<typeof operationLogs>;
