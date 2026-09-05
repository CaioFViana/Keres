import type { CreateStoryArcDataType, CreateStoryUpdate } from '@keres/shared';
import { CreateStoryArcDataSchema, PartialStoryArcSchema } from '@keres/shared';
import { db } from '../../db';
import { storyArcs } from '../../db/schema';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

export class StoryArcSyncHandler extends BaseSyncEntityHandler<
  typeof CreateStoryArcDataSchema,
  typeof PartialStoryArcSchema
> {
  entityName = 'StoryArc';

  constructor() {
    super('id', 'version', CreateStoryArcDataSchema, PartialStoryArcSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  async create(_userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const data: CreateStoryArcDataType = this.createSchema.parse(update.data);
    const existing = await this.findById(update.id!);
    if (existing) {
      throw new Error(`Conflict: StoryArc with ID ${update.id} already exists.`);
    }

    const siblings = await db.query.storyArcs.findMany({
      where: (table, { and, eq }) => and(eq(table.storyId, storyId), eq(table.isDeleted, false)),
    });
    const sortOrder = data.sortOrder ?? siblings.length;
    const isDefault = siblings.length === 0 ? true : data.isDefault;

    await db.insert(storyArcs).values({
      id: update.id!,
      storyId,
      title: data.title,
      description: data.description ?? null,
      sortOrder,
      color: data.color ?? null,
      icon: data.icon ?? null,
      themeOverride: data.themeOverride ?? null,
      isDefault,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
      deletedAt: null,
    });
  }
}
