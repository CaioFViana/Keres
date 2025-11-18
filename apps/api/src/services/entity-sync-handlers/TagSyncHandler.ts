import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { tags } from '../../db/schema';
import { CreateTagDataSchema, CreateTagDataType, PartialTagSchema } from '../../schemas/TagSchemas';
import { CreateStoryUpdate, UpdateStoryUpdate, DeleteStoryUpdate } from '../../schemas/SyncSchemas';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

export class TagSyncHandler extends BaseSyncEntityHandler<typeof CreateTagDataSchema, typeof PartialTagSchema> {
  entityName = 'Tag';

  constructor() {
    super(
      'tags',
      'id',
      'version',
      CreateTagDataSchema,
      PartialTagSchema,
      {
        storyIdColumnName: 'storyId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      }
    );
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const validatedData: CreateTagDataType = this.createSchema.parse(update.data);

    // Check for existing tag with the same name within the same story
    const existingTag = await db.query.tags.findFirst({
      where: and(
        eq(tags.storyId, storyId),
        eq(tags.name, validatedData.name),
        eq(tags.isDeleted, false)
      ),
    });

    if (existingTag) {
      throw new Error(`Conflict: Tag with name "${validatedData.name}" already exists in story ${storyId}.`);
    }

    await db.insert(tags).values({
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

  async update(userId: string, storyId: string, update: UpdateStoryUpdate, currentEntity: any): Promise<void> {
    const validatedChanges = this.updateSchema.parse(update.changes);

    // If the name is being updated, check for uniqueness within the story
    if (validatedChanges.name && validatedChanges.name !== currentEntity.name) {
      const existingTag = await db.query.tags.findFirst({
        where: and(
          eq(tags.storyId, storyId),
          eq(tags.name, validatedChanges.name),
          eq(tags.isDeleted, false),
          eq(tags.id, update.id!) // Exclude the current tag from the check
        ),
      });

      if (existingTag) {
        throw new Error(`Conflict: Tag with name "${validatedChanges.name}" already exists in story ${storyId}.`);
      }
    }
    
    // If color, isFavorite, or extraNotes are changed, ensure they are passed to the super.update
    await super.update(userId, storyId, update, currentEntity);
  }

  async delete(userId: string, storyId: string, update: DeleteStoryUpdate, currentEntity: any): Promise<void> {
    await super.delete(userId, storyId, update, currentEntity);
  }
}