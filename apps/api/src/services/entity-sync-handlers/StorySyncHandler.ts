import type { SyncStoredEntityFor } from './BaseSyncEntityHandler';
import type {
  CreateStoryUpdate,
  DeleteStoryUpdate,
  StoryReorderingStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import type { ChapterType } from '@keres/shared';
import {
  CreateStoryDataSchema,
  PartialStorySchema,
  completeReorderProblem,
  sameReorderArrangement,
  StoryReorderingStoryUpdateSchema,
} from '@keres/shared';
import { ownerOnlyFieldsIn } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import type { z } from 'zod';
import { db, type CompatibleDb } from '../../db';
import { chapters, galleries, stats, stories, storySchemaFields } from '../../db/schema';
import { mediaStorageService } from '../MediaStorageService';
import {
  BaseSyncEntityHandler,
  SyncConflictError,
  type SyncEntityRow,
  type SyncEntityMutationPolicyContext,
  type SyncOperationPolicyContext,
} from './BaseSyncEntityHandler';

/**
 * Sync handler for the story root. Besides persisting the Story row and its reorder operations, it
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

    // Validate operationTime is not in the future
    const clientOperationTime = new Date(update.operationTime!);
    if (clientOperationTime.getTime() > new Date().getTime() + 1000) {
      // Allow 1 second clock skew
      throw new Error(`Operation time ${update.operationTime} cannot be in the future.`);
    }

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

  // Override the update method to handle StoryReorderingStoryUpdate
  async update(
    userId: string,
    storyId: string,
    update: UpdateStoryUpdate | StoryReorderingStoryUpdate,
    currentEntity: SyncStoredEntityFor<typeof this.createSchema>,
    database: CompatibleDb = db,
  ): Promise<void> {
    if (update.type === 'reorder' && update.entity === 'Story') {
      const validatedReorderUpdate: StoryReorderingStoryUpdate =
        StoryReorderingStoryUpdateSchema.parse(update);

      // Empty is malformed, never an idempotent resend: there is no arrangement to compare
      // against the live rows, and logging one would store a row no other client can apply.
      const emptyProblem =
        validatedReorderUpdate.reorderItems.length === 0 ? completeReorderProblem([], []) : null;
      if (emptyProblem) {
        throw new SyncConflictError('validation', emptyProblem);
      }

      // Idempotent resend, and ONLY on a stale base (see ChapterSyncHandler for why a
      // fresh base always flows through): per target below, when the rows already sit exactly
      // where the items want them, there is nothing to apply - succeeding here (rather than
      // version-conflicting below) is what lets a client retry a reorder whose response was
      // lost. Matching the live arrangement means the items name exactly the live rows, and
      // this path writes nothing either way, so no validation is skipped that could matter.
      // Stats and schema fields persist 0-based `order` while chapters persist the 1-based
      // wire `index` - each comparison mirrors its own write mapping.
      const reorderBaseStale = validatedReorderUpdate.version! !== currentEntity.version;
      if (reorderBaseStale && validatedReorderUpdate.reorderTarget === 'Stat') {
        const currentStats = await database.query.stats.findMany({
          where: and(eq(stats.storyId, validatedReorderUpdate.id!), eq(stats.isDeleted, false)),
          columns: { id: true, order: true },
        });
        if (
          sameReorderArrangement(
            currentStats.map((stat) => ({ id: stat.id, newIndex: stat.order + 1 })),
            validatedReorderUpdate.reorderItems,
          )
        ) {
          return;
        }
      } else if (
        reorderBaseStale &&
        validatedReorderUpdate.reorderTarget === 'StorySchemaField' &&
        validatedReorderUpdate.schemaEntityType
      ) {
        const currentFields = await database.query.storySchemaFields.findMany({
          where: and(
            eq(storySchemaFields.storyId, validatedReorderUpdate.id!),
            eq(storySchemaFields.entityType, validatedReorderUpdate.schemaEntityType),
            eq(storySchemaFields.isDeleted, false),
          ),
          columns: { id: true, order: true },
        });
        if (
          sameReorderArrangement(
            currentFields.map((field) => ({ id: field.id, newIndex: field.order + 1 })),
            validatedReorderUpdate.reorderItems,
          )
        ) {
          return;
        }
      } else if (
        reorderBaseStale &&
        (validatedReorderUpdate.reorderTarget === undefined ||
          validatedReorderUpdate.reorderTarget === 'Event')
      ) {
        const reorderedType: ChapterType =
          validatedReorderUpdate.reorderTarget === 'Event' ? 'event' : 'chapter';
        const currentChapters = await database.query.chapters.findMany({
          where: and(
            eq(chapters.storyId, validatedReorderUpdate.id!),
            eq(chapters.type, reorderedType),
            eq(chapters.isDeleted, false),
          ),
          columns: { id: true, index: true },
        });
        if (
          sameReorderArrangement(
            currentChapters.map((chapter) => ({ id: chapter.id, newIndex: chapter.index })),
            validatedReorderUpdate.reorderItems,
          )
        ) {
          return;
        }
      }

      // Perform version check for the Story itself
      this.checkVersionConflict(
        validatedReorderUpdate.version!,
        currentEntity.version,
        validatedReorderUpdate.id!,
      );

      if (validatedReorderUpdate.reorderTarget === 'Stat') {
        await database.transaction(async (tx) => {
          const existingStats = await tx.query.stats.findMany({
            where: and(eq(stats.storyId, validatedReorderUpdate.id!), eq(stats.isDeleted, false)),
            columns: { id: true, version: true },
          });
          const problem = completeReorderProblem(
            existingStats.map((stat) => stat.id),
            validatedReorderUpdate.reorderItems,
          );
          if (problem) throw new SyncConflictError('validation', problem);
          await Promise.all(
            validatedReorderUpdate.reorderItems.map((item) => {
              const stat = existingStats.find((candidate) => candidate.id === item.id)!;
              return tx
                .update(stats)
                .set({ order: item.newIndex - 1, updatedAt: new Date(), version: stat.version + 1 })
                .where(eq(stats.id, item.id));
            }),
          );
          await tx
            .update(stories)
            .set({ updatedAt: new Date(), version: currentEntity.version + 1 })
            .where(eq(stories.id, validatedReorderUpdate.id!));
        });
        return;
      }

      if (validatedReorderUpdate.reorderTarget === 'StorySchemaField') {
        if (!validatedReorderUpdate.schemaEntityType) {
          throw new SyncConflictError(
            'validation',
            'Validation Error: Attribute reorders require a schema entity type.',
          );
        }
        const existingFields = await database.query.storySchemaFields.findMany({
          where: and(
            eq(storySchemaFields.storyId, validatedReorderUpdate.id!),
            eq(storySchemaFields.entityType, validatedReorderUpdate.schemaEntityType),
            eq(storySchemaFields.isDeleted, false),
          ),
          columns: { id: true, version: true },
        });
        const problem = completeReorderProblem(
          existingFields.map((field) => field.id),
          validatedReorderUpdate.reorderItems,
        );
        if (problem) throw new SyncConflictError('validation', problem);

        await database.transaction(async (tx) => {
          await Promise.all(
            validatedReorderUpdate.reorderItems.map((item) => {
              const field = existingFields.find((candidate) => candidate.id === item.id)!;
              return tx
                .update(storySchemaFields)
                .set({
                  order: item.newIndex - 1,
                  updatedAt: new Date(),
                  version: field.version + 1,
                })
                .where(eq(storySchemaFields.id, item.id));
            }),
          );
          await tx
            .update(stories)
            .set({ updatedAt: new Date(), version: currentEntity.version + 1 })
            .where(eq(stories.id, validatedReorderUpdate.id!));
        });
        return;
      }

      /**
       * Chapters and events share the `chapters` table and each owns an independent 1..N space.
       *
       * The scope has to reach the query, not just the validation: a payload listing every event is
       * complete for the events and short for the chapters, so a handler that looked at the whole
       * table would call one of the two a validation error whichever way it was sent. Absent means
       * chapters, which is what this operation meant before events existed.
       */
      const reorderedType: ChapterType =
        validatedReorderUpdate.reorderTarget === 'Event' ? 'event' : 'chapter';

      await database.transaction(async (tx) => {
        // 1. Validate reorderItems against the containers of this kind in the story
        const existingChapters = await tx.query.chapters.findMany({
          where: and(
            eq(chapters.storyId, validatedReorderUpdate.id!),
            eq(chapters.type, reorderedType),
            eq(chapters.isDeleted, false),
          ),
          columns: {
            id: true,
            index: true,
            version: true,
          },
        });

        const problem = completeReorderProblem(
          existingChapters.map((chapter) => chapter.id),
          validatedReorderUpdate.reorderItems,
        );
        if (problem) {
          throw new SyncConflictError('validation', problem);
        }

        // 2. Batch Update Chapter Indices
        const updatePromises = validatedReorderUpdate.reorderItems.map((item) => {
          const chapterToUpdate = existingChapters.find((c) => c.id === item.id);
          if (!chapterToUpdate) {
            // This case should ideally be caught by the earlier validation, but as a safeguard
            throw new Error(`Chapter with ID ${item.id} not found in story during batch update.`);
          }
          // Increment chapter version, and update index and updatedAt
          return tx
            .update(chapters)
            .set({
              index: item.newIndex,
              updatedAt: new Date(),
              version: chapterToUpdate.version + 1,
            })
            .where(eq(chapters.id, item.id));
        });

        await Promise.all(updatePromises);

        // 3. Increment Story Version
        await tx
          .update(stories)
          .set({
            updatedAt: new Date(),
            version: currentEntity.version + 1,
          })
          .where(eq(stories.id, validatedReorderUpdate.id!));
      });
    } else {
      // If it's not a story reorder update, delegate to the base class's update method
      this.updateSchema.parse((update as UpdateStoryUpdate).changes);
      await super.update(userId, storyId, update as UpdateStoryUpdate, currentEntity, database);
    }
  }

  async delete(
    userId: string,
    storyId: string,
    update: DeleteStoryUpdate,
    currentEntity: SyncStoredEntityFor<typeof this.createSchema>,
    database: CompatibleDb = db,
  ): Promise<void> {
    await super.delete(userId, storyId, update, currentEntity, database);

    // The tombstone above is only the story's - it does not propagate to its Galleries (each entity
    // synchronizes its own tombstone independently), so without this sweep every hash that story ever
    // referenced would be orphaned on disk forever as soon as the story disappeared from everyone's view.
    const referencedHashes = await database
      .selectDistinct({ hash: galleries.hash })
      .from(galleries)
      .where(eq(galleries.storyId, update.id!));

    for (const { hash } of referencedHashes) {
      await mediaStorageService.deleteBlobIfUnreferenced(hash);
    }
  }
}
