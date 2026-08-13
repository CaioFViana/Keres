import { ChoiceCheckGroupType, CreateChoiceCheckGroupDataSchema, CreateStoryUpdate, DeleteStoryUpdate, PartialChoiceCheckGroupSchema, UpdateStoryUpdate } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { choiceCheckGroups, choices } from '../../db/schema';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

export class ChoiceCheckGroupSyncHandler extends BaseSyncEntityHandler<typeof CreateChoiceCheckGroupDataSchema, typeof PartialChoiceCheckGroupSchema> {
  entityName = 'ChoiceCheckGroup';

  constructor() {
    super(
      'choiceCheckGroups',
      'id',
      'version',
      CreateChoiceCheckGroupDataSchema,
      PartialChoiceCheckGroupSchema,
      {
        storyIdColumnName: 'storyId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      }
    );
  }

  private async validateRelatedEntities(storyId: string, choiceId: string): Promise<void> {
    const choiceExists = await db.query.choices.findFirst({
      where: and(eq(choices.id, choiceId), eq(choices.storyId, storyId), eq(choices.isDeleted, false)),
    });
    if (!choiceExists) {
      throw new Error(`Validation Error: Choice with ID ${choiceId} not found, is deleted, or does not belong to story ${storyId}.`);
    }
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const validatedData = this.createSchema.parse(update.data);

    await this.validateRelatedEntities(storyId, validatedData.choiceId);

    const currentGroup = await this.findById(update.id!);
    if (currentGroup) {
      throw new Error(`Conflict: ChoiceCheckGroup with ID ${update.id} already exists.`);
    }

    await db.insert(choiceCheckGroups).values({
      id: update.id!,
      storyId: storyId,
      choiceId: validatedData.choiceId,
      combinator: validatedData.combinator,
      order: validatedData.order,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
      deletedAt: null,
    });
  }

  async update(userId: string, storyId: string, update: UpdateStoryUpdate, currentEntity: any): Promise<void> {
    const validatedChanges = this.updateSchema.parse(update.changes);

    if (validatedChanges.choiceId !== undefined) {
      const newChoiceId: ChoiceCheckGroupType['choiceId'] = validatedChanges.choiceId ?? currentEntity.choiceId;
      await this.validateRelatedEntities(storyId, newChoiceId);
    }

    await super.update(userId, storyId, update, currentEntity);
  }

  async delete(userId: string, storyId: string, update: DeleteStoryUpdate, currentEntity: any): Promise<void> {
    await super.delete(userId, storyId, update, currentEntity);
  }
}
