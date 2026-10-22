import type { SyncStoredEntityFor, SyncWriteContext } from './BaseSyncEntityHandler';
import type {
  CreateStoryUpdate,
  CreateTagDataType,
  DeleteStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { CreateTagDataSchema, PartialTagSchema } from '@keres/shared';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/db';
import { tags } from '@/db/schema';
import { BaseSyncEntityHandler, duplicateOf } from './BaseSyncEntityHandler';

export class TagSyncHandler extends BaseSyncEntityHandler<
  typeof CreateTagDataSchema,
  typeof PartialTagSchema
> {
  entityName = 'Tag';
  readonly naturalKey = ['name'] as const;

  constructor() {
    super('id', 'version', CreateTagDataSchema, PartialTagSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  async create(update: CreateStoryUpdate, ctx: SyncWriteContext): Promise<void> {
    const { storyId, database = db } = ctx;
    const validatedData: CreateTagDataType = this.createSchema.parse(update.data);

    // Check for existing tag with the same name within the same story
    const existingTag = await database.query.tags.findFirst({
      where: and(
        eq(tags.storyId, storyId),
        eq(tags.name, validatedData.name),
        eq(tags.isDeleted, false),
      ),
    });

    if (existingTag) {
      throw duplicateOf(
        existingTag,
        `Conflict: Tag with name "${validatedData.name}" already exists in story ${storyId}.`,
      );
    }

    await database.insert(tags).values({
      id: update.id!,
      storyId: storyId,
      name: validatedData.name,
      color: validatedData.color,
      isFavorite: validatedData.isFavorite,
      extraNotes: validatedData.extraNotes,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      isDeleted: false,
      deletedAt: null,
    });
  }

  async update(
    update: UpdateStoryUpdate,
    currentEntity: SyncStoredEntityFor<typeof this.createSchema>,
    ctx: SyncWriteContext,
  ): Promise<void> {
    const { storyId, database = db } = ctx;
    const validatedChanges = this.updateSchema.parse(update.changes);

    // If the name is being updated, check for uniqueness within the story
    if (validatedChanges.name && validatedChanges.name !== currentEntity.name) {
      const existingTag = await database.query.tags.findFirst({
        where: and(
          eq(tags.storyId, storyId),
          eq(tags.name, validatedChanges.name),
          eq(tags.isDeleted, false),
          ne(tags.id, update.id!), // Exclude the current tag from the check
        ),
      });

      if (existingTag) {
        throw duplicateOf(
          existingTag,
          `Conflict: Tag with name "${validatedChanges.name}" already exists in story ${storyId}.`,
        );
      }
    }

    // If color, isFavorite, or extraNotes are changed, ensure they are passed to the super.update
    await super.update(update, currentEntity, ctx);
  }

  async delete(
    update: DeleteStoryUpdate,
    currentEntity: SyncStoredEntityFor<typeof this.createSchema>,
    ctx: SyncWriteContext,
  ): Promise<void> {
    await super.delete(update, currentEntity, ctx);
  }
}
