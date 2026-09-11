import type { SyncStoredEntityFor } from './BaseSyncEntityHandler';
import type {
  ChoiceCheckGroupType,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { CreateChoiceCheckGroupDataSchema, PartialChoiceCheckGroupSchema } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db, type CompatibleDb } from '../../db';
import { choiceCheckGroups, choices } from '../../db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

export class ChoiceCheckGroupSyncHandler extends BaseSyncEntityHandler<
  typeof CreateChoiceCheckGroupDataSchema,
  typeof PartialChoiceCheckGroupSchema
> {
  entityName = 'ChoiceCheckGroup';

  constructor() {
    super('id', 'version', CreateChoiceCheckGroupDataSchema, PartialChoiceCheckGroupSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  private async validateRelatedEntities(
    storyId: string,
    choiceId: string,
    database: CompatibleDb = db,
  ): Promise<void> {
    const choiceExists = await database.query.choices.findFirst({
      where: and(
        eq(choices.id, choiceId),
        eq(choices.storyId, storyId),
        eq(choices.isDeleted, false),
      ),
    });
    if (!choiceExists) {
      throw new SyncConflictError(
        'referenced_entity_deleted',
        `Validation Error: Choice with ID ${choiceId} not found, is deleted, or does not belong to story ${storyId}.`,
      );
    }
  }

  async create(
    userId: string,
    storyId: string,
    update: CreateStoryUpdate,
    database: CompatibleDb = db,
  ): Promise<void> {
    const validatedData = this.createSchema.parse(update.data);

    await this.validateRelatedEntities(storyId, validatedData.choiceId, database);

    const currentGroup = await this.findById(update.id!, database);
    if (currentGroup) {
      throw new Error(`Conflict: ChoiceCheckGroup with ID ${update.id} already exists.`);
    }

    await database.insert(choiceCheckGroups).values({
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

  async update(
    userId: string,
    storyId: string,
    update: UpdateStoryUpdate,
    currentEntity: SyncStoredEntityFor<typeof this.createSchema>,
    database: CompatibleDb = db,
  ): Promise<void> {
    const validatedChanges = this.updateSchema.parse(update.changes);

    if (validatedChanges.choiceId !== undefined) {
      const newChoiceId: ChoiceCheckGroupType['choiceId'] =
        validatedChanges.choiceId ?? currentEntity.choiceId;
      await this.validateRelatedEntities(storyId, newChoiceId, database);
    }

    await super.update(userId, storyId, update, currentEntity, database);
  }

  async delete(
    userId: string,
    storyId: string,
    update: DeleteStoryUpdate,
    currentEntity: SyncStoredEntityFor<typeof this.createSchema>,
    database: CompatibleDb = db,
  ): Promise<void> {
    await super.delete(userId, storyId, update, currentEntity, database);
  }
}
