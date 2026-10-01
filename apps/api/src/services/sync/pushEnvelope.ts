import type { StoryUpdate, SyncConflict } from '@keres/shared';
import {
  omitSyncImmutableFields,
  safeParseStoryUpdate,
  StoryUpdateTypeSchema,
} from '@keres/shared';
import type {
  SyncEntityHandler,
  SyncEntityRow,
} from '../entity-sync-handlers/BaseSyncEntityHandler';
import {
  clampOperationTime,
  SyncConflictError,
} from '../entity-sync-handlers/BaseSyncEntityHandler';
import { serializeSyncEntity } from './SyncConflictDetails';

/**
 * One pushed element, validated on its own: the operation ready to apply (its time clamped to the
 * server's clock), or the refusal to report for it. Validating element by element is what keeps a
 * single malformed operation from failing - on every retry - every valid one queued with it.
 */
export function readPushEnvelope(
  raw: unknown,
): { update: StoryUpdate } | { refusal: SyncConflict } {
  const parsed = safeParseStoryUpdate(raw);
  if (!parsed.success) {
    return {
      refusal: {
        ...describeInvalidUpdate(raw),
        reason: 'validation',
        message: `Invalid operation: ${parsed.error}`,
      },
    };
  }
  try {
    return {
      update: { ...parsed.data, operationTime: clampOperationTime(parsed.data.operationTime) },
    };
  } catch (error) {
    if (!(error instanceof SyncConflictError)) throw error;
    return {
      refusal: { ...describeInvalidUpdate(raw), reason: error.reason, message: error.message },
    };
  }
}

/**
 * The identifying envelope of an operation that failed validation, read leniently so the client
 * can still correlate the refusal with its own queued operation.
 */
function describeInvalidUpdate(
  raw: unknown,
): Pick<SyncConflict, 'clientOperationId' | 'entity' | 'entityId' | 'type'> {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const text = (field: unknown, fallback: string) =>
    typeof field === 'string' && field.length > 0 ? field : fallback;
  return {
    clientOperationId:
      typeof value.clientOperationId === 'string' ? value.clientOperationId : undefined,
    entity: text(value.entity, 'unknown'),
    entityId: text(value.id, ''),
    // The wire enum has no 'unknown'; an unreadable type reports as the neutral 'update'.
    type: StoryUpdateTypeSchema.safeParse(value.type).data ?? 'update',
  };
}

/**
 * The payload a deletion or a restore records: the whole row, not only what the client sent.
 *
 * While an entity is deleted, devices do not keep its content in step on their own - one accepted
 * the deletion with unsent edits still in its tombstone, another never pulled the last edits
 * before deleting. A deletion carrying the tombstone lets every device (and every pending
 * conflict) hold the server's row; a restore carrying the restored row brings the same row back
 * everywhere, even to a device whose tombstone drifted anyway. Undefined keeps the handler's
 * payload for every other operation.
 */
export function wholeRowPayload(
  handler: SyncEntityHandler,
  update: StoryUpdate,
  before: SyncEntityRow | undefined,
  after: SyncEntityRow | undefined,
): Record<string, unknown> | undefined {
  if (!before || !after) return undefined;
  const content = omitSyncImmutableFields(serializeSyncEntity(after));
  if (update.type === 'delete' && handler.isDeletedRow(after)) {
    return { id: update.id, ...content, isDeleted: true };
  }
  if (update.type === 'update' && handler.isDeletedRow(before) && !handler.isDeletedRow(after)) {
    return { ...content, isDeleted: false, deletedAt: null };
  }
  return undefined;
}

/**
 * The payload an applied operation records: what the handler wrote, not what arrived. A handler
 * may normalize what it stores (a pair of related characters sorted, a default filled in); logged
 * as sent, every other device would hold the unnormalized value while the server holds the other.
 * Each field the sanitized payload names takes its stored value; deletions and restores record the
 * whole row (`wholeRowPayload`).
 */
export function writtenPayload(
  handler: SyncEntityHandler,
  update: StoryUpdate,
  before: SyncEntityRow | undefined,
  after: SyncEntityRow | undefined,
  actingUserId: string,
): Record<string, unknown> | undefined {
  const whole = wholeRowPayload(handler, update, before, after);
  if (whole) return whole;
  if (!after || (update.type !== 'create' && update.type !== 'update')) return undefined;
  const logged = handler.sanitizePayloadForLog(update, actingUserId);
  const stored = serializeSyncEntity(after) as Record<string, unknown>;
  for (const field of Object.keys(logged)) {
    if (field === 'isDeleted' || field === 'deletedAt' || !(field in stored)) continue;
    logged[field] = stored[field];
  }
  return logged;
}
