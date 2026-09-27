import { z } from 'zod';

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

/** Push batch ceiling. The HTTP cap still applies; this avoids a batch of tens of thousands of ops. */
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
/**
 * There is no container order: a row's place is its own `rank`, moved by an ordinary update of that
 * row (`rules/rank.ts`).
 */
export const StoryUpdateTypeSchema = z.enum(['create', 'update', 'delete']);
export type StoryUpdateType = z.infer<typeof StoryUpdateTypeSchema>;

// 2. Base schema for any StoryUpdate
// It holds the fields common to every operation
export const BaseStoryUpdateSchema = z
  .object({
    entity: z.string().min(1, 'Entity name cannot be empty'), // Entity name (e.g. 'Story', 'Character')
    // Create, update and delete all require the ULID; the envelope leaves it optional and each
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
    operationTime: z.string().datetime().optional(),
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
  id: UlidSchema, // ID is required for updates
  // Without `version` the schema refuses the batch (422). The client engine always sends the base
  // here; refusing the omitted one closes the door to a tampered client.
  changes: z.object({ version: z.number().int().min(0) }).passthrough(),
});
export type UpdateStoryUpdate = z.infer<typeof UpdateStoryUpdateSchema>;

// 5. Schema for delete operations
export const DeleteStoryUpdateSchema = BaseStoryUpdateSchema.extend({
  type: z.literal('delete'),
  id: UlidSchema, // ID is required for deletes
  // Optional on purpose: `StoryService.deleteStory`/`unlinkFromServer` omit the version because the
  // local `stories.version` never stayed in lockstep with the server. With no version, the server only
  // accepts deleting the Story itself when the caller is the owner (it forces the tombstone at the
  // current version). Other entities still require the base in the handler.
  version: z.number().int().min(0).optional(),
  /**
   * Pull only: the tombstone's content as the server holds it. Devices do not keep a deleted
   * entity's fields in step on their own (one accepted the deletion with unsent edits still in
   * its row), so the deletion carries them - a later restore then brings back the same row
   * everywhere. Absent on history recorded before it existed; ignored on push.
   */
  data: z.record(z.string(), z.any()).optional(),
});
export type DeleteStoryUpdate = z.infer<typeof DeleteStoryUpdateSchema>;

// 6. Union type for every StoryUpdate operation
export const StoryUpdateSchema = z.union([
  CreateStoryUpdateSchema,
  UpdateStoryUpdateSchema,
  DeleteStoryUpdateSchema,
]);
export type StoryUpdate = z.infer<typeof StoryUpdateSchema>;

/**
 * Validates ONE operation against the variant its own `type` selects. Same acceptance as `StoryUpdateSchema`, but the refusal names the exact field instead
 * of dumping every union branch - it ends up in a conflict message the user may read. Shared so
 * the client refuses locally exactly what the server would refuse, before it poisons a batch.
 */
export function safeParseStoryUpdate(
  raw: unknown,
): { success: true; data: StoryUpdate } | { success: false; error: string } {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const schema =
    value.type === 'create'
      ? CreateStoryUpdateSchema
      : value.type === 'update'
        ? UpdateStoryUpdateSchema
        : value.type === 'delete'
          ? DeleteStoryUpdateSchema
          : null;
  if (!schema) {
    return { success: false, error: `Unknown operation type '${String(value.type)}'.` };
  }
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { success: true, data: parsed.data };
  const issues = parsed.error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
  return { success: false, error: issues.join('; ') };
}

// 7. Schema for an array of StoryUpdates (what the server will receive)
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
  /** The entity was edited on the server, but the client deleted it locally. */
  'edited_on_server',
  /** The client and the server changed the same fields of the same entity. */
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
  /**
   * A create (or an edit of its identifying fields) names what a live row of another id already is:
   * the same tag name, the same pair of related characters, the same entity's value for one field...
   * Two devices made it offline. `serverEntity` is that existing row, and the client folds its own
   * into it - nothing to ask unless their contents differ.
   */
  'duplicate',
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
  /**
   * Current state of the entity on the server, so the screen can show the comparison. For a
   * `duplicate`, the live row the operation would duplicate (its twin) instead.
   */
  serverEntity: z.record(z.string(), z.any()).nullable().optional(),
  /**
   * Only for a `duplicate` of a row the server already holds (a restore, an edit of its identifying
   * fields): that row as the server holds it - a tombstone the client returns to, or a live row it
   * deletes as it folds into the twin.
   */
  ownEntity: z.record(z.string(), z.any()).nullable().optional(),
  /** What the client tried to write, so the screen can show the comparison. */
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
  /**
   * Only present for `reason: 'version_conflict'` on an `update` or `delete`: the server operation
   * that last wrote the entity. A client already holding it has seen every change to the entity, so
   * its base is behind only in version bookkeeping and its operation rebases with nothing to decide.
   */
  entityOperationVersion: z.number().int().optional(),
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
