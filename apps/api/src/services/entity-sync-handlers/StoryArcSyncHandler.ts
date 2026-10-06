import type { CreateStoryArcDataType, CreateStoryUpdate } from '@keres/shared';
import { CreateStoryArcDataSchema, PartialStoryArcSchema } from '@keres/shared';
import { and, eq, ne } from 'drizzle-orm';
import { db, type CompatibleDb } from '../../db';
import { storyArcs } from '../../db/schema';
import { BaseSyncEntityHandler, type SyncEntityRow } from './BaseSyncEntityHandler';

export class StoryArcSyncHandler extends BaseSyncEntityHandler<
  typeof CreateStoryArcDataSchema,
  typeof PartialStoryArcSchema
> {
  entityName = 'StoryArc';
  /**
   * A story has one default arc. Two devices that each made the story's first arc offline both
   * made it the default; the second is the first's twin (`findLiveTwin`) - any other arc is its own.
   */
  readonly naturalKey = ['isDefault'] as const;

  constructor() {
    super('id', 'version', CreateStoryArcDataSchema, PartialStoryArcSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  async create(
    _userId: string,
    storyId: string,
    update: CreateStoryUpdate,
    database: CompatibleDb = db,
  ): Promise<void> {
    const data: CreateStoryArcDataType = this.createSchema.parse(update.data);
    const existing = await this.findById(update.id!, database);
    if (existing) {
      throw new Error(`Conflict: StoryArc with ID ${update.id} already exists.`);
    }

    const siblings = await database.query.storyArcs.findMany({
      where: (table, { and, eq }) => and(eq(table.storyId, storyId), eq(table.isDeleted, false)),
    });
    const sortOrder = data.sortOrder ?? siblings.length;
    const isDefault = siblings.length === 0 ? true : data.isDefault;

    await database.insert(storyArcs).values({
      id: update.id!,
      storyId,
      title: data.title,
      description: data.description ?? null,
      sortOrder,
      color: data.color ?? null,
      icon: data.icon ?? null,
      themeOverride: data.themeOverride ?? null,
      medium: data.medium,
      vocabulary: data.vocabulary ?? null,
      author: data.author ?? null,
      coverGalleryId: data.coverGalleryId ?? null,
      isDefault,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
      deletedAt: null,
    });
  }

  override async findLiveTwin(
    storyId: string,
    row: SyncEntityRow,
    database: CompatibleDb = db,
  ): Promise<SyncEntityRow | undefined> {
    const fields = row as Record<string, unknown>;
    if (fields.isDefault !== true) return undefined;
    return (await database.query.storyArcs.findFirst({
      where: and(
        eq(storyArcs.storyId, storyId),
        eq(storyArcs.isDefault, true),
        eq(storyArcs.isDeleted, false),
        ne(storyArcs.id, String(fields.id ?? '')),
      ),
    })) as SyncEntityRow | undefined;
  }
}
