import {
  CreateChoiceCheckDataSchema,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  PartialChoiceCheckSchema,
  UpdateStoryUpdate,
} from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { choiceCheckGroups, choiceChecks, items, scenes } from '../../db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

export class ChoiceCheckSyncHandler extends BaseSyncEntityHandler<
  typeof CreateChoiceCheckDataSchema,
  typeof PartialChoiceCheckSchema
> {
  entityName = 'ChoiceCheck';

  constructor() {
    super('choiceChecks', 'id', 'version', CreateChoiceCheckDataSchema, PartialChoiceCheckSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  private async validateRelatedEntities(
    storyId: string,
    groupId: string,
    sceneId: string | null,
    itemId: string | null,
  ): Promise<void> {
    const groupExists = await db.query.choiceCheckGroups.findFirst({
      where: and(
        eq(choiceCheckGroups.id, groupId),
        eq(choiceCheckGroups.storyId, storyId),
        eq(choiceCheckGroups.isDeleted, false),
      ),
    });
    if (!groupExists) {
      throw new SyncConflictError(
        'referenced_entity_deleted',
        `Validation Error: ChoiceCheckGroup with ID ${groupId} not found, is deleted, or does not belong to story ${storyId}.`,
      );
    }

    if (sceneId) {
      const sceneExists = await db.query.scenes.findFirst({
        where: and(
          eq(scenes.id, sceneId),
          eq(scenes.storyId, storyId),
          eq(scenes.isDeleted, false),
        ),
      });
      if (!sceneExists) {
        throw new SyncConflictError(
          'referenced_entity_deleted',
          `Validation Error: Scene with ID ${sceneId} not found, is deleted, or does not belong to story ${storyId}.`,
        );
      }
    }

    if (itemId) {
      const itemExists = await db.query.items.findFirst({
        where: and(eq(items.id, itemId), eq(items.storyId, storyId), eq(items.isDeleted, false)),
      });
      if (!itemExists) {
        throw new SyncConflictError(
          'referenced_entity_deleted',
          `Validation Error: Item with ID ${itemId} not found, is deleted, or does not belong to story ${storyId}.`,
        );
      }
    }
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const validatedData = this.createSchema.parse(update.data);

    await this.validateRelatedEntities(
      storyId,
      validatedData.groupId,
      validatedData.sceneId,
      validatedData.itemId,
    );

    const currentCheck = await this.findById(update.id!);
    if (currentCheck) {
      throw new Error(`Conflict: ChoiceCheck with ID ${update.id} already exists.`);
    }

    await db.insert(choiceChecks).values({
      id: update.id!,
      storyId: storyId,
      groupId: validatedData.groupId,
      mode: validatedData.mode,
      type: validatedData.type,
      order: validatedData.order,
      sceneId: validatedData.sceneId,
      minVisits: validatedData.minVisits,
      itemId: validatedData.itemId,
      itemPresence: validatedData.itemPresence,
      triggerName: validatedData.triggerName,
      triggerState: validatedData.triggerState,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
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

    const newGroupId = validatedChanges.groupId ?? currentEntity.groupId;
    const newSceneId =
      validatedChanges.sceneId !== undefined ? validatedChanges.sceneId : currentEntity.sceneId;
    const newItemId =
      validatedChanges.itemId !== undefined ? validatedChanges.itemId : currentEntity.itemId;

    if (
      validatedChanges.groupId !== undefined ||
      validatedChanges.sceneId !== undefined ||
      validatedChanges.itemId !== undefined
    ) {
      await this.validateRelatedEntities(storyId, newGroupId, newSceneId, newItemId);
    }

    await super.update(userId, storyId, update, currentEntity);
  }

  async delete(
    userId: string,
    storyId: string,
    update: DeleteStoryUpdate,
    currentEntity: any,
  ): Promise<void> {
    await super.delete(userId, storyId, update, currentEntity);
  }
}
