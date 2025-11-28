import { CreateStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { worldRules } from '../../db/schema';
import { CreateWorldRuleDataSchema, CreateWorldRuleDataType, PartialWorldRuleSchema } from '../../schemas/WorldRuleSchemas';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

export class WorldRuleSyncHandler extends BaseSyncEntityHandler<typeof CreateWorldRuleDataSchema, typeof PartialWorldRuleSchema> {
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
      }
    );
  }

  private async validateRelatedEntities(storyId: string): Promise<void> {
    // WorldRule has no direct related entities to validate
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    // Validate incoming data against the create schema
    const validatedData: CreateWorldRuleDataType = this.createSchema.parse(update.data);

    const currentWorldRule = await this.findById(update.id!);
    if (currentWorldRule) {
      throw new Error(`Conflict: WorldRule with ID ${update.id} already exists.`);
    }

    await this.validateRelatedEntities(storyId);

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

  async update(userId: string, storyId: string, update: UpdateStoryUpdate, currentEntity: any): Promise<void> {
    const validatedChanges = this.updateSchema.parse(update.changes);

    await this.validateRelatedEntities(storyId);

    await db.update(worldRules)
      .set({
        ...validatedChanges,
        updatedAt: new Date(),
        version: currentEntity.version + 1,
      })
      .where(and(
        eq(worldRules.id, update.id!),
        eq(worldRules.version, currentEntity.version)
      ));
  }
}
