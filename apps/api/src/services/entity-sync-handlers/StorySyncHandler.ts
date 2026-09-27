import type { SyncStoredEntityFor } from './BaseSyncEntityHandler';
import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { CreateStoryDataSchema, PartialStorySchema } from '@keres/shared';
import { ownerOnlyFieldsIn } from '@keres/shared';
import type { z } from 'zod';
import { db, type CompatibleDb } from '../../db';
import { stories } from '../../db/schema';
import {
  BaseSyncEntityHandler,
  SyncConflictError,
  type SyncEntityRow,
  type SyncEntityMutationPolicyContext,
  type SyncOperationPolicyContext,
} from './BaseSyncEntityHandler';

/**
 * Sync handler for the story root. Besides persisting the Story row, it
 * owns the root-only policy: a sync endpoint may only target its own story and identity/policy
 * changes or deletion require the story owner.
 */
export class StorySyncHandler extends BaseSyncEntityHandler<
  typeof CreateStoryDataSchema,
  typeof PartialStorySchema
> {
  entityName = 'Story';
  tierLimitScope = 'story' as const;

  assertOperationAllowed(context: SyncOperationPolicyContext): void {
    const { role, storyId, update } = context;
    if (update.type === 'create' && update.id !== storyId) {
      throw new SyncConflictError(
        'unauthorized',
        'Cannot create a different story through this sync endpoint.',
      );
    }
    if (update.type === 'delete' && role !== 'owner') {
      throw new SyncConflictError('unauthorized', 'Only the story owner can delete the story.');
    }
    if (update.type === 'update' && role !== 'owner') {
      const attempted = ownerOnlyFieldsIn(update.changes as Record<string, unknown> | undefined);
      if (attempted.length > 0 || update.changes?.isDeleted === false) {
        throw new SyncConflictError(
          'unauthorized',
          'Only the story owner can change story identity or policy.',
        );
      }
    }
  }

  prepareDelete(
    context: SyncEntityMutationPolicyContext,
    update: DeleteStoryUpdate,
  ): DeleteStoryUpdate {
    if (context.role === 'owner' && (update.version === undefined || update.version === null)) {
      return { ...update, version: context.currentEntity.version };
    }
    return update;
  }

  protected payloadForLog(
    parsed: Record<string, unknown>,
    actingUserId: string,
  ): Record<string, unknown> {
    const payload = super.payloadForLog(parsed, actingUserId);
    delete payload.userId;
    return payload;
  }

  constructor() {
    super('id', 'version', CreateStoryDataSchema, PartialStorySchema, {
      userIdColumnName: 'userId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  /**
   * Story has an undefined `storyIdColumnName` (it is the top itself, not a child row of a story), so
   * the base class assumes "a top-level row, no way to check, let it through" - which in practice checks
   * nothing. Without this override, a user with write access to their own story A could push
   * `{entity:'Story', type:'update'|'delete', id:<another user's story B>}` to `/sync/A` and change or
   * delete story B just by knowing its ULID. "Belonging to the story" for the Story itself can only mean
   * "being that story".
   */
  checkBelongsToStory(entity: SyncEntityRow, storyId: string): boolean {
    return entity.id === storyId;
  }

  async create(
    userId: string,
    storyId: string,
    update: CreateStoryUpdate,
    database: CompatibleDb = db,
  ): Promise<void> {
    // Validate incoming data against the create schema
    const validatedData: z.infer<typeof CreateStoryDataSchema> = this.createSchema.parse(
      update.data,
    );

    // Clamped to the server's clock; an absent time (it is optional on the wire) means "now"
    // instead of an Invalid Date reaching the insert.
    const clientOperationTime = this.parseOperationTime(update.operationTime);

    await database.insert(stories).values({
      id: update.id!,
      userId: userId, // Set by server
      createdAt: clientOperationTime,
      updatedAt: clientOperationTime,
      version: 1,
      isDeleted: false,
      deletedAt: null,
      ...validatedData,
    });
  }

  async update(
    userId: string,
    storyId: string,
    update: UpdateStoryUpdate,
    currentEntity: SyncStoredEntityFor<typeof this.createSchema>,
    database: CompatibleDb = db,
  ): Promise<void> {
    this.updateSchema.parse(update.changes);
    await super.update(userId, storyId, update, currentEntity, database);
  }

  async delete(
    userId: string,
    storyId: string,
    update: DeleteStoryUpdate,
    currentEntity: SyncStoredEntityFor<typeof this.createSchema>,
    database: CompatibleDb = db,
  ): Promise<void> {
    await super.delete(userId, storyId, update, currentEntity, database);
    // No blob sweep here: it runs in the push coordinator after the commit (see
    // `collectPushMediaGarbage`). Inside this transaction the check would read stale state - and
    // bytes deleted first would stay deleted if the transaction then rolled back.
  }
}
