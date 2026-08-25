import type { CreateStoryUpdate, CreateWorldRuleDataType } from '@keres/shared';
import { CreateWorldRuleDataSchema, PartialWorldRuleSchema } from '@keres/shared';
import { db } from '../../db';
import { worldRules } from '../../db/schema';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

export class WorldRuleSyncHandler extends BaseSyncEntityHandler<
  typeof CreateWorldRuleDataSchema,
  typeof PartialWorldRuleSchema
> {
  entityName = 'WorldRule';

  constructor() {
    super(
      'worldRules', // Pass table name as string
      'id',
      'version',
      CreateWorldRuleDataSchema,
      PartialWorldRuleSchema,
      {
        storyIdColumnName: 'storyId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      },
    );
  }

  private async validateRelatedEntities(): Promise<void> {
    // WorldRule has no direct related entities to validate
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    // Validate incoming data against the create schema
    const validatedData: CreateWorldRuleDataType = this.createSchema.parse(update.data);

    const currentWorldRule = await this.findById(update.id!);
    if (currentWorldRule) {
      throw new Error(`Conflict: WorldRule with ID ${update.id} already exists.`);
    }

    await this.validateRelatedEntities();

    await db.insert(worldRules).values({
      id: update.id!, // Explicitly provide ID from update, as it's a ULID from client
      storyId: storyId, // Ensure storyId is set from the context
      ...validatedData, // Spread the validated data from the client
      version: 1, // Ensure version starts at 1 for new creations
      createdAt: new Date(), // Ensure createdAt is set
      updatedAt: new Date(), // Ensure updatedAt is set
      isDeleted: false, // Ensure isDeleted is false
      deletedAt: null, // Ensure deletedAt is null
    });
  }

  // `update` and `delete` come from the base class on purpose. There used to be an override here that
  // only repeated what the base does, but without `checkVersionConflict`, without the
  // `deleted_on_server` check and without honouring the client's `operationTime` - the result was that a
  // concurrent edit on this entity produced no conflict at all and, when the `where version = ...` clause
  // did not match, the user's edit vanished with no error and no warning.
}
