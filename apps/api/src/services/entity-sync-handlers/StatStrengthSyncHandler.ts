import type {
  CreateStatStrengthDataType,
  CreateStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { CreateStatStrengthDataSchema, PartialStatStrengthSchema } from '@keres/shared';
import { and, eq, isNull, ne } from 'drizzle-orm';
import { db } from '../../db';
import { statStrengths, stats } from '../../db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

export class StatStrengthSyncHandler extends BaseSyncEntityHandler<
  typeof CreateStatStrengthDataSchema,
  typeof PartialStatStrengthSchema
> {
  entityName = 'StatStrength';

  constructor() {
    super(
      'statStrengths',
      'id',
      'version',
      CreateStatStrengthDataSchema,
      PartialStatStrengthSchema,
      {
        storyIdColumnName: 'storyId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      },
    );
  }

  private async assertStatExists(storyId: string, statId: string | null): Promise<void> {
    if (!statId) return; // Escada padrão da história: não referencia stat nenhum.

    const stat = await db.query.stats.findFirst({
      where: and(eq(stats.id, statId), eq(stats.storyId, storyId), eq(stats.isDeleted, false)),
    });
    if (!stat) {
      throw new SyncConflictError(
        'referenced_entity_deleted',
        `Validation Error: Stat with ID ${statId} not found, is deleted, or does not belong to story ${storyId}.`,
      );
    }
  }

  /**
   * Two rungs with the same floor make the ladder ambiguous: one of them would have a zero-width range
   * and no value would land in it. It is the case you asked the conflict system to flag, so it becomes a
   * `SyncConflictError` rather than a generic error - that way the client opens the resolution screen
   * and chooses which rung stays.
   */
  private async assertNoDuplicateFloor(
    storyId: string,
    statId: string | null,
    minValue: number,
    excludeId?: string,
  ): Promise<void> {
    const duplicate = await db.query.statStrengths.findFirst({
      where: and(
        eq(statStrengths.storyId, storyId),
        statId === null ? isNull(statStrengths.statId) : eq(statStrengths.statId, statId),
        eq(statStrengths.minValue, minValue),
        eq(statStrengths.isDeleted, false),
        ...(excludeId ? [ne(statStrengths.id, excludeId)] : []),
      ),
    });

    if (duplicate) {
      const ladder = statId ? `stat ${statId}` : `the story default ladder`;
      throw new SyncConflictError(
        'validation',
        `Validation Error: ${ladder} already has a tier starting at ${minValue}.`,
      );
    }
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const validatedData: CreateStatStrengthDataType = this.createSchema.parse(update.data);

    const existing = await this.findById(update.id!);
    if (existing) {
      throw new Error(`Conflict: StatStrength with ID ${update.id} already exists.`);
    }

    await this.assertStatExists(storyId, validatedData.statId);
    await this.assertNoDuplicateFloor(storyId, validatedData.statId, validatedData.minValue);

    await db.insert(statStrengths).values({
      id: update.id!,
      storyId,
      statId: validatedData.statId,
      label: validatedData.label,
      minValue: validatedData.minValue,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      isDeleted: false,
      deletedAt: null,
    });
  }

  async update(
    userId: string,
    storyId: string,
    update: UpdateStoryUpdate,
    currentEntity: any,
  ): Promise<void> {
    const validatedChanges = this.updateSchema.parse(update.changes);
    const nextStatId =
      validatedChanges.statId !== undefined ? validatedChanges.statId : currentEntity.statId;
    const nextMinValue =
      validatedChanges.minValue !== undefined ? validatedChanges.minValue : currentEntity.minValue;

    if (validatedChanges.statId !== undefined || validatedChanges.minValue !== undefined) {
      await this.assertStatExists(storyId, nextStatId);
      await this.assertNoDuplicateFloor(storyId, nextStatId, nextMinValue, update.id!);
    }

    await super.update(userId, storyId, update, currentEntity);
  }
}
