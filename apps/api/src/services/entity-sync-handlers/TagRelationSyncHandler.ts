import { CreateStoryUpdate, CreateTagRelationDataSchema, CreateTagRelationDataType, DeleteStoryUpdate, PartialTagRelationSchema, UpdateStoryUpdate } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { chapters, characters, choices, galleries, items, locations, notes, scenes, tagRelations, tags, worldRules } from '../../db/schema'; // Import all possible relation tables
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

export class TagRelationSyncHandler extends BaseSyncEntityHandler<typeof CreateTagRelationDataSchema, typeof PartialTagRelationSchema> {
  entityName = 'TagRelation';

  constructor() {
    super(
      'tagRelations',
      'id',
      'version',
      CreateTagRelationDataSchema,
      PartialTagRelationSchema,
      {
        storyIdColumnName: 'storyId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      }
    );
  }

  private async validateRelation(storyId: string, tagId: string, relationId: string, relationType: string): Promise<void> {
    // Validate Tag existence
    const tagExists = await db.query.tags.findFirst({
      where: and(eq(tags.id, tagId), eq(tags.storyId, storyId), eq(tags.isDeleted, false)),
    });
    if (!tagExists) {
      throw new Error(`Validation Error: Tag with ID ${tagId} not found, is deleted, or does not belong to story ${storyId}.`);
    }

    // Validate Relation existence based on relationType
    let relationExists = false;
    switch (relationType) {
      case 'Character':
        const character = await db.query.characters.findFirst({
          where: and(eq(characters.id, relationId), eq(characters.storyId, storyId), eq(characters.isDeleted, false)),
        });
        relationExists = !!character;
        break;
      case 'Location':
        const location = await db.query.locations.findFirst({
          where: and(eq(locations.id, relationId), eq(locations.storyId, storyId), eq(locations.isDeleted, false)),
        });
        relationExists = !!location;
        break;
      case 'Scene':
        const scene = await db.query.scenes.findFirst({
          where: and(eq(scenes.id, relationId), eq(scenes.storyId, storyId), eq(scenes.isDeleted, false)),
        });
        relationExists = !!scene;
        break;
      case 'Note':
        const note = await db.query.notes.findFirst({
          where: and(eq(notes.id, relationId), eq(notes.storyId, storyId), eq(notes.isDeleted, false)),
        });
        relationExists = !!note;
        break;
      case 'Gallery':
        const gallery = await db.query.galleries.findFirst({
          where: and(eq(galleries.id, relationId), eq(galleries.storyId, storyId), eq(galleries.isDeleted, false)),
        });
        relationExists = !!gallery;
        break;
      case 'WorldRule':
        const worldRule = await db.query.worldRules.findFirst({
          where: and(eq(worldRules.id, relationId), eq(worldRules.storyId, storyId), eq(worldRules.isDeleted, false)),
        });
        relationExists = !!worldRule;
        break;
      case 'Choice':
        const choice = await db.query.choices.findFirst({
          where: and(eq(choices.id, relationId), eq(choices.storyId, storyId), eq(choices.isDeleted, false)),
        });
        relationExists = !!choice;
        break;
      case 'Item':
        const item = await db.query.items.findFirst({
          where: and(eq(items.id, relationId), eq(items.storyId, storyId), eq(items.isDeleted, false)),
        });
        relationExists = !!item;
        break;
      case 'Chapter':
        const chapter = await db.query.chapters.findFirst({
          where: and(eq(chapters.id, relationId), eq(chapters.storyId, storyId), eq(chapters.isDeleted, false)),
        });
        relationExists = !!chapter;
        break;
      default:
        throw new Error(`Validation Error: Unknown relationType "${relationType}".`);
    }

    if (!relationExists) {
      throw new Error(`Validation Error: Entity with ID ${relationId} of type ${relationType} not found, is deleted, or does not belong to story ${storyId}.`);
    }
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const validatedData: CreateTagRelationDataType = this.createSchema.parse(update.data);

    await this.validateRelation(storyId, validatedData.tagId, validatedData.relationId, validatedData.relationType);

    // Check for existing tag relation with the same tagId, relationId, and relationType within the same story
    const existingTagRelation = await db.query.tagRelations.findFirst({
      where: and(
        eq(tagRelations.storyId, storyId),
        eq(tagRelations.tagId, validatedData.tagId),
        eq(tagRelations.relationId, validatedData.relationId),
        eq(tagRelations.relationType, validatedData.relationType),
        eq(tagRelations.isDeleted, false)
      ),
    });

    if (existingTagRelation) {
      throw new Error(`Conflict: TagRelation for Tag ID ${validatedData.tagId}, Relation ID ${validatedData.relationId} (Type: ${validatedData.relationType}) already exists in story ${storyId}.`);
    }

    await db.insert(tagRelations).values({
      id: update.id!,
      storyId: storyId,
      tagId: validatedData.tagId,
      relationId: validatedData.relationId,
      relationType: validatedData.relationType,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      isDeleted: false,
      deletedAt: null,
    });
  }

  async update(userId: string, storyId: string, update: UpdateStoryUpdate, currentEntity: any): Promise<void> {
    const validatedChanges = this.updateSchema.parse(update.changes);

    const newTagId = validatedChanges.tagId || currentEntity.tagId;
    const newRelationId = validatedChanges.relationId || currentEntity.relationId;
    const newRelationType = validatedChanges.relationType || currentEntity.relationType;

    // Validate related entities if any key fields are being updated
    if (
      validatedChanges.tagId !== undefined ||
      validatedChanges.relationId !== undefined ||
      validatedChanges.relationType !== undefined
    ) {
      await this.validateRelation(storyId, newTagId, newRelationId, newRelationType);

      // Check for uniqueness of the new relation (if key fields were changed)
      const existingTagRelation = await db.query.tagRelations.findFirst({
        where: and(
          eq(tagRelations.storyId, storyId),
          eq(tagRelations.tagId, newTagId),
          eq(tagRelations.relationId, newRelationId),
          eq(tagRelations.relationType, newRelationType),
          eq(tagRelations.isDeleted, false),
          eq(tagRelations.id, update.id!) // Exclude the current relation from the check
        ),
      });

      if (existingTagRelation && existingTagRelation.id !== update.id) {
        throw new Error(`Conflict: TagRelation for Tag ID ${newTagId}, Relation ID ${newRelationId} (Type: ${newRelationType}) already exists in story ${storyId}.`);
      }
    }

    await super.update(userId, storyId, update, currentEntity);
  }

  async delete(userId: string, storyId: string, update: DeleteStoryUpdate, currentEntity: any): Promise<void> {
    await super.delete(userId, storyId, update, currentEntity);
  }
}
