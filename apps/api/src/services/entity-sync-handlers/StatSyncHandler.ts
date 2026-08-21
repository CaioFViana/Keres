import {
  CreateStatDataSchema,
  CreateStatDataType,
  CreateStoryUpdate,
  MAX_PRIMARY_STATS,
  PartialStatSchema,
  UpdateStoryUpdate,
} from '@keres/shared';
import { and, count, eq, ne } from 'drizzle-orm';
import { db } from '../../db';
import { stats } from '../../db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

export class StatSyncHandler extends BaseSyncEntityHandler<
  typeof CreateStatDataSchema,
  typeof PartialStatSchema
> {
  entityName = 'Stat';

  constructor() {
    super('stats', 'id', 'version', CreateStatDataSchema, PartialStatSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  /**
   * O radar não sobrevive a mais de 12 eixos, então o teto é invariante de dado e não só de UI:
   * um cliente antigo (ou adulterado) não pode empurrar o 13º primário pela sincronização.
   */
  private async assertPrimaryLimit(storyId: string, excludeId?: string): Promise<void> {
    const [row] = await db
      .select({ total: count() })
      .from(stats)
      .where(
        and(
          eq(stats.storyId, storyId),
          eq(stats.isPrimary, true),
          eq(stats.isDeleted, false),
          ...(excludeId ? [ne(stats.id, excludeId)] : []),
        ),
      );

    if ((row?.total ?? 0) >= MAX_PRIMARY_STATS) {
      throw new SyncConflictError(
        'validation',
        `Validation Error: story ${storyId} already has the maximum of ${MAX_PRIMARY_STATS} primary stats.`,
      );
    }
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const validatedData: CreateStatDataType = this.createSchema.parse(update.data);

    const existing = await this.findById(update.id!);
    if (existing) {
      throw new Error(`Conflict: Stat with ID ${update.id} already exists.`);
    }
    if (validatedData.isPrimary) await this.assertPrimaryLimit(storyId);

    await db.insert(stats).values({
      id: update.id!,
      storyId,
      name: validatedData.name,
      isPrimary: validatedData.isPrimary,
      order: validatedData.order,
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

    // Só custa uma contagem quando o secundário está sendo promovido.
    if (validatedChanges.isPrimary === true && currentEntity.isPrimary === false) {
      await this.assertPrimaryLimit(storyId, update.id!);
    }

    await super.update(userId, storyId, update, currentEntity);
  }
}
