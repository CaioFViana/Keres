import type {
  CreateStoryUpdate,
  DeleteStoryUpdate,
  EffectiveStoryRole,
  StoryUpdate,
  SyncConflictReason,
  UpdateStoryUpdate,
} from '@keres/shared';
import {
  getSimpleDisplayName,
  omitSyncImmutableFields,
  SYNC_CLIENT_IMMUTABLE_FIELD_SET,
} from '@keres/shared';
import type { SQL } from 'drizzle-orm';
import { and, count, eq, inArray, sql } from 'drizzle-orm';
import type { PgTableWithColumns } from 'drizzle-orm/pg-core';
import type { z } from 'zod'; // Import Zod
import { db } from '../../db';
import { getApiEntityTable } from '../entity-solvers/ApiEntityTableRegistry';

/**
 * Shared API implementation for database-backed entity sync handlers. It provides generic OCC,
 * tombstone, validation, lookup, and log-payload behavior; concrete handlers own their table's
 * creation rules and any entity-specific access policy exposed to SyncPushService.
 */

/** Policy context supplied by the protocol coordinator, not by the database-backed entity itself. */
export type SyncOperationPolicyContext = {
  userId: string;
  storyId: string;
  role: EffectiveStoryRole;
  allowReaderComments: boolean;
  update: StoryUpdate;
};

export type SyncEntityMutationPolicyContext = SyncOperationPolicyContext & {
  currentEntity: Record<string, any>;
};

/**
 * Refusal of an operation the *user* can resolve, as opposed to a programming or infrastructure error.
 *
 * It exists so `SyncService` can tell the two apart: a conflict goes back to the client described in
 * the push's response (which then opens the resolution screen), and not as a 500 that takes the whole
 * batch down and tells the client nothing about what to do.
 */
export class SyncConflictError extends Error {
  readonly reason: SyncConflictReason;
  readonly clientVersion?: number;
  readonly serverVersion?: number;

  constructor(
    reason: SyncConflictReason,
    message: string,
    versions?: { clientVersion?: number; serverVersion?: number },
  ) {
    super(message);
    this.name = 'SyncConflictError';
    this.reason = reason;
    this.clientVersion = versions?.clientVersion;
    this.serverVersion = versions?.serverVersion;
  }
}

/**
 * JSONB does not preserve object-key insertion order. A raw `JSON.stringify` comparison therefore
 * treats `{ nodes: [], edges: [] }` and the identical JSONB value read back as
 * `{ edges: [], nodes: [] }` as different. Entity create retries must compare JSON by value.
 */
function valuesMatch(left: unknown, right: unknown): boolean {
  if (left instanceof Date || right instanceof Date) {
    const leftTime = left instanceof Date ? left.getTime() : new Date(String(left)).getTime();
    const rightTime = right instanceof Date ? right.getTime() : new Date(String(right)).getTime();
    return leftTime === rightTime;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => valuesMatch(value, right[index]))
    );
  }
  if (typeof left === 'object' && left !== null && typeof right === 'object' && right !== null) {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord).sort();
    const rightKeys = Object.keys(rightRecord).sort();
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key, index) => key === rightKeys[index] && valuesMatch(leftRecord[key], rightRecord[key]),
      )
    );
  }
  return (left ?? null) === (right ?? null);
}

export interface SyncEntityHandler {
  entityName: string;
  findById(id: string): Promise<any | undefined>;
  create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void>;
  update(
    userId: string,
    storyId: string,
    update: UpdateStoryUpdate,
    currentEntity: any,
  ): Promise<void>;
  delete(
    userId: string,
    storyId: string,
    update: DeleteStoryUpdate,
    currentEntity: any,
  ): Promise<void>;
  checkOwnership(entity: any, userId: string): boolean;
  checkBelongsToStory(entity: any, storyId: string): boolean;
  /** The payload the log should relay: what was written, not the client's raw JSON. */
  sanitizePayloadForLog(update: StoryUpdate, actingUserId: string): Record<string, any>;
  /** A resent create: does the sanitised payload describe the same row that already exists? */
  createPayloadMatches(existing: any, incomingData: Record<string, any>): boolean;
  /** Counts non-deleted rows of this entity in the given stories. Used by TierEnforcementService. */
  countForStoryIds(storyIds: string[]): Promise<number>;
  allowsReaderWrite(context: SyncOperationPolicyContext): boolean;
  assertOperationAllowed(context: SyncOperationPolicyContext): void;
  assertEntityMutationAllowed(context: SyncEntityMutationPolicyContext): void;
  prepareDelete(
    context: SyncEntityMutationPolicyContext,
    update: DeleteStoryUpdate,
  ): DeleteStoryUpdate;
  tierLimitScope: 'story' | 'entity' | 'none';
  /** Deleted rows (tombstones), optionally restricted to one story. Used by AdminRecoveryService. */
  findDeleted(storyId?: string): Promise<
    Array<{
      id: string;
      storyId: string | null;
      deletedAt: Date | null;
      version: number;
      name: string | null;
      /** The raw row, for composite enrichment in AdminRecoveryService (it does not go in the HTTP response). */
      row: Record<string, unknown>;
    }>
  >;
}

export abstract class BaseSyncEntityHandler<
  CreateType extends z.ZodType<Record<string, any>>,
  UpdateType extends z.ZodType<Record<string, any>>,
> implements SyncEntityHandler
{
  abstract entityName: string;
  tierLimitScope: 'story' | 'entity' | 'none' = 'entity';
  protected idColumnName: string;
  protected storyIdColumnName?: string;
  protected userIdColumnName?: string;
  protected versionColumnName: string;
  protected isDeletedColumnName?: string;
  protected deletedAtColumnName?: string;
  protected createSchema: CreateType; // Zod schema for creation
  protected updateSchema: UpdateType; // Zod schema for updates

  /** The API entity-table registry is the sole mapping from a domain entity to host persistence. */
  protected get table(): PgTableWithColumns<any> {
    const table = getApiEntityTable(this.entityName);
    if (!table) {
      throw new Error(`No table registered for sync entity '${this.entityName}'.`);
    }
    return table as PgTableWithColumns<any>;
  }

  constructor(
    idColumnName: string,
    versionColumnName: string,
    createSchema: CreateType, // New: Zod schema for creation
    updateSchema: UpdateType, // New: Zod schema for updates
    options?: {
      storyIdColumnName?: string;
      userIdColumnName?: string;
      isDeletedColumnName?: string;
      deletedAtColumnName?: string;
    },
  ) {
    this.idColumnName = idColumnName;
    this.versionColumnName = versionColumnName;
    this.createSchema = createSchema;
    this.updateSchema = updateSchema;
    this.storyIdColumnName = options?.storyIdColumnName;
    this.userIdColumnName = options?.userIdColumnName;
    this.isDeletedColumnName = options?.isDeletedColumnName;
    this.deletedAtColumnName = options?.deletedAtColumnName;
  }

  async findById(id: string): Promise<any | undefined> {
    const results = await db
      .select()
      .from(this.table)
      .where(eq((this.table as any)[this.idColumnName], id))
      .limit(1);
    return results.at(0);
  }

  async countForStoryIds(storyIds: string[]): Promise<number> {
    if (!this.storyIdColumnName || storyIds.length === 0) {
      return 0;
    }
    const conditions = [inArray((this.table as any)[this.storyIdColumnName], storyIds)];
    if (this.isDeletedColumnName) {
      conditions.push(eq((this.table as any)[this.isDeletedColumnName], false));
    }
    const [row] = await db
      .select({ count: count() })
      .from(this.table)
      .where(and(...conditions));
    return row?.count ?? 0;
  }

  async findDeleted(storyId?: string): Promise<
    Array<{
      id: string;
      storyId: string | null;
      deletedAt: Date | null;
      version: number;
      name: string | null;
      row: Record<string, unknown>;
    }>
  > {
    if (!this.isDeletedColumnName) {
      return [];
    }
    const conditions = [eq((this.table as any)[this.isDeletedColumnName], true)];
    if (storyId && this.storyIdColumnName) {
      conditions.push(eq((this.table as any)[this.storyIdColumnName], storyId));
    }
    const rows = await db
      .select()
      .from(this.table)
      .where(and(...conditions));
    return rows.map((r: any) => {
      const row = r as Record<string, unknown>;
      return {
        id: r[this.idColumnName],
        storyId: this.storyIdColumnName ? r[this.storyIdColumnName] : null,
        deletedAt: this.deletedAtColumnName ? r[this.deletedAtColumnName] : null,
        version: r[this.versionColumnName],
        name: getSimpleDisplayName(this.entityName, row),
        row,
      };
    });
  }

  abstract create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void>;

  async update(
    userId: string,
    storyId: string,
    update: UpdateStoryUpdate,
    currentEntity: any,
  ): Promise<void> {
    // `isDeleted`/`deletedAt` are handled outside validation because they are not an ordinary field edit:
    // they are the *restoration* of a deleted entity. Extracting them before validating avoids depending on
    // every entity schema accepting those fields.
    const incomingChanges: Record<string, any> = { ...update.changes };
    const restoreRequested = incomingChanges.isDeleted === false;
    delete incomingChanges.isDeleted;
    delete incomingChanges.deletedAt;

    this.assertNoImmutableFieldWrites(incomingChanges);

    const isDeletedOnServer = !!(
      this.isDeletedColumnName && currentEntity[this.isDeletedColumnName]
    );
    if (isDeletedOnServer && !restoreRequested) {
      // The entity was deleted here while the client was editing it offline. Applying the edit silently
      // would write the user's work into a row nobody else sees, so we hand the case back for them to decide
      // (restore, or accept the deletion).
      throw new SyncConflictError(
        'deleted_on_server',
        `Conflict: ${this.entityName} ${update.id} was deleted on the server.`,
        {
          clientVersion: update.changes.version,
          serverVersion: currentEntity[this.versionColumnName],
        },
      );
    }

    this.checkVersionConflict(
      update.changes.version,
      currentEntity[this.versionColumnName],
      update.id!,
    );

    // Validate incoming changes against the update schema.
    const validatedChanges: z.infer<UpdateType> = this.updateSchema.parse(incomingChanges);
    this.stripImmutableFields(validatedChanges as Record<string, any>);
    this.keepOnlyProvidedKeys(validatedChanges as Record<string, any>, incomingChanges);

    // Validate operationTime is not in the future
    const clientOperationTime = this.parseOperationTime(update.operationTime);

    const changes: Record<string, any> = {
      ...validatedChanges, // Use validated changes
      updatedAt: clientOperationTime, // Use client's operationTime for updatedAt
      [this.versionColumnName]:
        sql`${(this.table as any)[this.versionColumnName]} + 1` as SQL<number>,
    };

    if (restoreRequested && this.isDeletedColumnName && this.deletedAtColumnName) {
      changes[this.isDeletedColumnName] = false;
      changes[this.deletedAtColumnName] = null;
    }

    // The `checkVersionConflict` above only compares against the version this request read
    // before its transaction started - it can't see a second transaction that reads the same
    // base version and commits first. Guarding the write itself with `version = <base>` closes
    // that gap: Postgres serializes the two UPDATEs via row lock, the loser's WHERE no longer
    // matches once the winner has committed a new version, and `.returning()` coming back empty
    // is how we tell "genuinely raced" apart from "row just doesn't exist" (already ruled out by
    // `currentEntity` being loaded above).
    const [updated] = await db
      .update(this.table)
      .set(changes)
      .where(
        and(
          eq((this.table as any)[this.idColumnName], update.id!),
          eq((this.table as any)[this.versionColumnName], currentEntity[this.versionColumnName]),
        ),
      )
      .returning({ id: (this.table as any)[this.idColumnName] });

    if (!updated) {
      throw new SyncConflictError(
        'version_conflict',
        `Conflict: ${this.entityName} ${update.id} was modified concurrently.`,
        {
          clientVersion: update.changes.version,
          serverVersion: currentEntity[this.versionColumnName],
        },
      );
    }
  }

  async delete(
    userId: string,
    storyId: string,
    update: DeleteStoryUpdate,
    currentEntity: any,
  ): Promise<void> {
    if (!this.isDeletedColumnName || !this.deletedAtColumnName) {
      throw new Error(
        `Delete not supported for entity ${this.entityName}: missing isDeletedColumnName or deletedAtColumnName.`,
      );
    }

    if (currentEntity[this.isDeletedColumnName]) {
      // It is already deleted: resending the same deletion (because the previous response was lost, for
      // instance) is not a conflict, it is the operation having already taken effect.
      return;
    }

    this.checkVersionConflict(update.version!, currentEntity[this.versionColumnName], update.id!);

    // Validate operationTime is not in the future
    const clientOperationTime = this.parseOperationTime(update.operationTime);

    const [deleted] = await db
      .update(this.table)
      .set({
        [this.isDeletedColumnName]: true,
        [this.deletedAtColumnName]: clientOperationTime, // Use client's operationTime for deletedAt
        [this.versionColumnName]:
          sql`${(this.table as any)[this.versionColumnName]} + 1` as SQL<number>,
        updatedAt: clientOperationTime, // Use client's operationTime for updatedAt
      })
      .where(
        and(
          eq((this.table as any)[this.idColumnName], update.id!),
          eq((this.table as any)[this.versionColumnName], currentEntity[this.versionColumnName]),
        ),
      )
      .returning({ id: (this.table as any)[this.idColumnName] });

    if (!deleted) {
      throw new SyncConflictError(
        'version_conflict',
        `Conflict: ${this.entityName} ${update.id} was modified concurrently.`,
        {
          clientVersion: update.version,
          serverVersion: currentEntity[this.versionColumnName],
        },
      );
    }
  }

  /** Rejects times in the future (beyond 1s of slack for clock skew). */
  protected parseOperationTime(operationTime: string | undefined): Date {
    const clientOperationTime = operationTime ? new Date(operationTime) : new Date();
    if (clientOperationTime.getTime() > new Date().getTime() + 1000) {
      throw new SyncConflictError(
        'validation',
        `Operation time ${operationTime} cannot be in the future.`,
      );
    }
    return clientOperationTime;
  }

  checkOwnership(entity: any, userId: string): boolean {
    if (!this.userIdColumnName) {
      // If there's no userIdColumnName, ownership might not be applicable or checked elsewhere
      return true;
    }
    return entity[this.userIdColumnName] === userId;
  }

  checkBelongsToStory(entity: any, storyId: string): boolean {
    if (!this.storyIdColumnName) {
      // If there's no storyIdName, it might be a top-level entity like Story itself
      return true;
    }
    return entity[this.storyIdColumnName] === storyId;
  }

  allowsReaderWrite(_context: SyncOperationPolicyContext): boolean {
    return false;
  }

  assertOperationAllowed(_context: SyncOperationPolicyContext): void {}

  assertEntityMutationAllowed(_context: SyncEntityMutationPolicyContext): void {}

  prepareDelete(
    _context: SyncEntityMutationPolicyContext,
    update: DeleteStoryUpdate,
  ): DeleteStoryUpdate {
    return update;
  }

  /**
   * Optimistic concurrency control: the operation is only accepted if the client built it on the version
   * the server holds right now.
   *
   * The comparison is equality, not `<`. With no version the server refuses: last-write-wins let a
   * tampered-with client overwrite any concurrent edit.
   */
  protected checkVersionConflict(
    clientVersion: number | undefined,
    serverVersion: number,
    entityId: string,
  ): void {
    if (clientVersion === undefined || clientVersion === null) {
      throw new SyncConflictError(
        'validation',
        `Conflict: ${this.entityName} ${entityId} is missing a base version.`,
      );
    }

    if (clientVersion === serverVersion) {
      return;
    }

    throw new SyncConflictError(
      'version_conflict',
      `Conflict: ${this.entityName} ${entityId} is outdated. Client base version ${clientVersion} != server version ${serverVersion}.`,
      { clientVersion, serverVersion },
    );
  }

  sanitizePayloadForLog(update: StoryUpdate, actingUserId: string): Record<string, any> {
    if (update.type === 'create') {
      const parsed = this.createSchema.parse(update.data) as Record<string, any>;
      return this.payloadForLog(parsed, actingUserId);
    }
    if (update.type === 'update') {
      const incoming: Record<string, any> = { ...(update as UpdateStoryUpdate).changes };
      const restoreRequested = incoming.isDeleted === false;
      delete incoming.isDeleted;
      delete incoming.deletedAt;
      const parsed = this.updateSchema.parse(incoming) as Record<string, any>;
      this.keepOnlyProvidedKeys(parsed, incoming);
      const payload = this.payloadForLog(parsed, actingUserId);
      if (restoreRequested) {
        payload.isDeleted = false;
        payload.deletedAt = null;
      }
      return payload;
    }
    if (update.type === 'delete') {
      return { id: update.id };
    }
    if (update.type === 'reorder') {
      return {
        reorderItems: (update as { reorderItems?: unknown }).reorderItems,
        reorderTarget: (update as { reorderTarget?: unknown }).reorderTarget,
        schemaEntityType: (update as { schemaEntityType?: unknown }).schemaEntityType,
      };
    }
    return {};
  }

  createPayloadMatches(existing: any, incomingData: Record<string, any>): boolean {
    let parsed: Record<string, any>;
    try {
      parsed = this.createSchema.parse(incomingData) as Record<string, any>;
    } catch {
      return false;
    }
    for (const [key, value] of Object.entries(parsed)) {
      if (SYNC_CLIENT_IMMUTABLE_FIELD_SET.has(key)) continue;
      if (key === 'userId' || key === 'authorUserId') continue;
      if (value === undefined) continue;
      if (!valuesMatch(existing?.[key], value)) {
        return false;
      }
    }
    return true;
  }

  /**
   * `storyId`/`userId`/`id` in an update's body are a transplant or identity theft. `version` is the OCC
   * base and stays out of this check.
   */
  protected assertNoImmutableFieldWrites(changes: Record<string, any>): void {
    const attempted = ['id', 'storyId', 'userId', 'authorUserId', 'lastOperationVersion'].filter(
      (field) => changes[field] !== undefined,
    );
    if (attempted.length === 0) return;
    throw new SyncConflictError(
      'unauthorized',
      `Cannot write server-managed field(s) ${attempted.join(', ')} on ${this.entityName}.`,
    );
  }

  /** Zod `.partial()` keeps `.default()` active; without this, a name-only patch would reset isFavorite. */
  protected keepOnlyProvidedKeys(parsed: Record<string, any>, provided: Record<string, any>): void {
    for (const key of Object.keys(parsed)) {
      if (!(key in provided)) delete parsed[key];
    }
  }

  protected stripImmutableFields(changes: Record<string, any>): void {
    for (const field of SYNC_CLIENT_IMMUTABLE_FIELD_SET) {
      delete changes[field];
    }
  }

  protected payloadForLog(parsed: Record<string, any>, _actingUserId?: string): Record<string, any> {
    return omitSyncImmutableFields(parsed);
  }
}
