// packages/shared/entities/sync/SyncSchemas.ts
import { z } from 'zod';
import { STORY_SCHEMA_ENTITY_TYPES } from '../metadata/StorySchemaEntityType';

// Define a Zod schema for ULID strings
export const UlidSchema = z.string().regex(/^[0-9A-Z]{26}$/, 'Invalid ULID format');

/**
 * Fields the client may never write through sync. Update schemas omit these fields; the base
 * handler and the operation log discard them too. `version` in the envelope/`changes` is only the
 * OCC base - it is not written to the column.
 */
export const SYNC_CLIENT_IMMUTABLE_FIELDS = [
  'id',
  'storyId',
  'userId',
  'authorUserId',
  'version',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'isDeleted',
  'lastOperationVersion',
] as const;

export const SYNC_CLIENT_IMMUTABLE_FIELD_SET: ReadonlySet<string> = new Set(
  SYNC_CLIENT_IMMUTABLE_FIELDS,
);

/** Teto do lote de push. O cap HTTP ainda vale; isto evita um lote de dezenas de milhares de ops. */
export const MAX_SYNC_BATCH_SIZE = 200;

/** Ceiling of operations returned in a single pull. The client pulls again from the cursor. */
export const MAX_SYNC_PULL_BATCH = 500;

export function omitSyncImmutableFields<T extends Record<string, unknown>>(
  value: T,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    if (SYNC_CLIENT_IMMUTABLE_FIELD_SET.has(key)) continue;
    out[key] = fieldValue;
  }
  return out;
}

// 1. Defines the kind of synchronization operation
export const StoryUpdateTypeSchema = z.enum(['create', 'update', 'delete', 'reorder']); // Added 'reorder'
export type StoryUpdateType = z.infer<typeof StoryUpdateTypeSchema>;

// 2. Base schema for any StoryUpdate
// It holds the fields common to every operation
export const BaseStoryUpdateSchema = z
  .object({
    entity: z.string().min(1, 'Entity name cannot be empty'), // Nome da entidade (ex: 'Story', 'Character')
    // Create, update, delete and reorder all require the ULID; the envelope leaves it optional and each
    // concrete variant re-declares it where it is mandatory.
    id: UlidSchema.optional(),
    /**
     * The *entity's* version, the basis of optimistic concurrency control.
     *
     * The field is directional:
     * - push (client -> server): it is the version the client read BEFORE applying the change (the
     *   "base"). The server rejects the operation if its own version differs from that base, because
     *   that means somebody wrote in between.
     * - pull (server -> client): it is the entity's version AFTER the operation, so the client knows
     *   which base its next edits rest on.
     *
     * CAREFUL, for `update` operations: what the server reads as the base is `changes.version`, not this
     * field (see `BaseSyncEntityHandler.checkVersionConflict`, fed by `update.changes.version`).
     * `UpdateStoryUpdateSchema` requires `changes.version`; a push omitting that field is refused at
     * validation (422), it does not become last-write-wins. `SyncEngineService` duplicates the value in
     * both places.
     *
     * It must never receive the *operation's* version (`operationVersion`): they are different counters
     * and confusing them switches conflict detection off.
     */
    version: z.number().int().min(0).optional(),
    // The *operation's* version in the server's operation log
    operationVersion: z.number().int().min(0).optional(),
  })
  .extend({
    operationTime: z.string().datetime().optional(), // CHANGED: Expect ISO string, as per user's instruction
    originatingUser: z.string().optional(),
    /**
     * Id of the row in the *client's local* operation log. Sent on push and returned untouched in the
     * response, so the client knows exactly which operations were applied and which conflicted, instead
     * of treating the batch as all-or-nothing.
     */
    clientOperationId: z.string().optional(),
    /**
     * Id of the row in the *server's* operation log. Filled in on pull so the client can record the
     * remote operation idempotently (re-pulls neither duplicate nor collide in the local log).
     */
    operationId: z.string().optional(),
  });

// 3. Schema for create operations
export const CreateStoryUpdateSchema = BaseStoryUpdateSchema.extend({
  type: z.literal('create'),
  // The client generates the ULID before sending - with no id the server has nothing to write.
  id: UlidSchema,
  // 'data' holds the complete object of the new entity
  data: z.record(z.string(), z.any()), // A placeholder; it can be made more specific later
});
export type CreateStoryUpdate = z.infer<typeof CreateStoryUpdateSchema>;

// 4. Schema for update operations
export const UpdateStoryUpdateSchema = BaseStoryUpdateSchema.extend({
  type: z.literal('update'),
  id: UlidSchema, // ID é obrigatório para atualizações
  // Without `version` the schema refuses the batch (422). The client engine always sends the base
  // aqui; recusar o omitido fecha a porta para um cliente adulterado.
  changes: z.object({ version: z.number().int().min(0) }).passthrough(),
});
export type UpdateStoryUpdate = z.infer<typeof UpdateStoryUpdateSchema>;

// 5. Schema for delete operations
export const DeleteStoryUpdateSchema = BaseStoryUpdateSchema.extend({
  type: z.literal('delete'),
  id: UlidSchema, // ID é obrigatório para exclusões
  // Optional on purpose: `StoryService.deleteStory`/`unlinkFromServer` omit the version because the
  // local `stories.version` never stayed in lockstep with the server. With no version, the server only
  // accepts deleting the Story itself when the caller is the owner (it forces the tombstone at the
  // current version). Other entities still require the base in the handler.
  version: z.number().int().min(0).optional(),
});
export type DeleteStoryUpdate = z.infer<typeof DeleteStoryUpdateSchema>;

// Define a Zod schema for the items within the reorder update
export const ReorderItemSchema = z.object({
  id: UlidSchema,
  newIndex: z.number().int().min(1),
});

// 6. Schema for reordering scenes within a chapter
export const ChapterReorderingStoryUpdateSchema = BaseStoryUpdateSchema.extend({
  type: z.literal('reorder'),
  entity: z.literal('Chapter'), // Entity to which reorderItems belong
  id: UlidSchema, // ID of the Chapter whose scenes are being reordered
  reorderItems: z.array(ReorderItemSchema), // Array of scene IDs and their new indices
});
export type ChapterReorderingStoryUpdate = z.infer<typeof ChapterReorderingStoryUpdateSchema>;

// 7. Schema for reordering chapters within a story
export const StoryReorderingStoryUpdateSchema = BaseStoryUpdateSchema.extend({
  type: z.literal('reorder'),
  entity: z.literal('Story'), // Entity to which reorderItems belong
  id: UlidSchema, // ID of the Story whose chapters are being reordered
  reorderItems: z.array(ReorderItemSchema), // Array of chapter IDs and their new indices
  reorderTarget: z.literal('StorySchemaField').optional(),
  // The closed set, and not `z.string()`: the column stores exactly these values, and an unknown type
  // would only produce a query that finds nothing - silently.
  schemaEntityType: z.enum(STORY_SCHEMA_ENTITY_TYPES).optional(),
});
export type StoryReorderingStoryUpdate = z.infer<typeof StoryReorderingStoryUpdateSchema>;

// 8. Union type for every StoryUpdate operation
export const StoryUpdateSchema = z.union([
  CreateStoryUpdateSchema,
  UpdateStoryUpdateSchema,
  DeleteStoryUpdateSchema,
  ChapterReorderingStoryUpdateSchema,
  StoryReorderingStoryUpdateSchema,
]);
export type StoryUpdate = z.infer<typeof StoryUpdateSchema>;

// 9. Schema for an array of StoryUpdates (what the server will receive)
export const StoryUpdatesArraySchema = z.array(StoryUpdateSchema).max(MAX_SYNC_BATCH_SIZE);
export type StoryUpdatesArray = z.infer<typeof StoryUpdatesArraySchema>;

// 10. Per-operation result of a push
//
// The push stopped being all-or-nothing: each operation is applied on its own and the server returns
// what went through and what conflicted. Without that the client cannot tell "the server refused my
// edit" from "the whole batch failed", and ends up marking refused operations as synchronized
// (losing the user's work) or resending them forever.

/** Why the server refused the operation. It determines what the conflict screen offers. */
export const SyncConflictReasonSchema = z.enum([
  /** The base the client sent is not the server's current version: somebody edited in between. */
  'version_conflict',
  /** The entity does not exist on the server (it never got there, or it was permanently removed). */
  'not_found',
  /** The entity was deleted on the server, but the client was still editing it. */
  'deleted_on_server',
  /** A entidade foi editada no servidor, mas o cliente a excluiu localmente. */
  'edited_on_server',
  /** O cliente e o servidor mudaram os mesmos campos da mesma entidade. */
  'concurrent_edit',
  /**
   * The operation references another entity (character, scene, item...) that was deleted on the
   * server. "Keep my version" will never go through on its own here - the reference still points at
   * something that no longer exists - so the conflict screen handles this case separately, without
   * offering that option.
   */
  'referenced_entity_deleted',
  /** The payload failed the server's validation. Not resolvable by the user. */
  'validation',
  /** The user has no permission for the operation. Not resolvable by the user. */
  'unauthorized',
  /**
   * The user's plan does not allow another story/entity/byte of storage. Not resolvable by editing the
   * operation - it is informational only and does not open the conflict screen.
   */
  'limit_exceeded',
  /** Any other failure while applying the operation. */
  'unknown',
]);
export type SyncConflictReason = z.infer<typeof SyncConflictReasonSchema>;

export const SyncConflictSchema = z.object({
  /** Echoes the refused operation's `clientOperationId`, so the client can correlate. */
  clientOperationId: z.string().optional(),
  entity: z.string(),
  entityId: z.string(),
  type: StoryUpdateTypeSchema,
  reason: SyncConflictReasonSchema,
  /** A technical message for the log. The conflict screen uses `reason`, not this. */
  message: z.string(),
  /** The base version the client sent. */
  clientVersion: z.number().int().optional(),
  /** The entity's current version on the server. */
  serverVersion: z.number().int().optional(),
  /** Estado atual da entidade no servidor, para a tela poder mostrar o comparativo. */
  serverEntity: z.record(z.string(), z.any()).nullable().optional(),
  /** O que o cliente tentou gravar, para a tela poder mostrar o comparativo. */
  attemptedChanges: z.record(z.string(), z.any()).optional(),
  /**
   * Only present for `reason: 'version_conflict'` on an `update`: the fields that actually changed on
   * the entity since the version the client read as its base (reconstructed from the server's
   * operation history, not a diff against `serverEntity`). Without this the client cannot tell "the
   * base went stale because another field changed" (silently mergeable) from "the same field I edited
   * also changed over there" (a real decision) - comparing `serverEntity` directly against what the
   * client wants to write does not work, because the current value of a field the client is editing
   * always looks "different" from the new value, whether the server touched it or not.
   */
  changedFields: z.array(z.string()).optional(),
});
export type SyncConflict = z.infer<typeof SyncConflictSchema>;

export const SyncAppliedOperationSchema = z.object({
  clientOperationId: z.string().optional(),
  /**
   * Id of the operation in the server's log. Absent when the operation was already applied and had
   * therefore already been recorded by an earlier push (an idempotent resend).
   */
  operationId: z.string().optional(),
  /** The operation's position in the server's sequence. */
  operationVersion: z.number().int(),
  /** The entity's version after the operation, so the client can rebase its next edits. */
  entityVersion: z.number().int().optional(),
  entity: z.string(),
  entityId: z.string(),
});
export type SyncAppliedOperation = z.infer<typeof SyncAppliedOperationSchema>;

export const SyncPushResultSchema = z.object({
  message: z.string(),
  processedUpdates: z.number().int(),
  serverMaxOperationVersion: z.number().int(),
  applied: z.array(SyncAppliedOperationSchema),
  conflicts: z.array(SyncConflictSchema),
});
export type SyncPushResult = z.infer<typeof SyncPushResultSchema>;
