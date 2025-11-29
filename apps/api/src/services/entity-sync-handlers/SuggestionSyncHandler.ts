import { CreateStoryUpdate, CreateSuggestionDataSchema, CreateSuggestionDataType, DeleteStoryUpdate, PartialSuggestionSchema, UpdateStoryUpdate } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { suggestions } from '../../db/schema';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

export class SuggestionSyncHandler extends BaseSyncEntityHandler<typeof CreateSuggestionDataSchema, typeof PartialSuggestionSchema> {
  entityName = 'Suggestion';

  constructor() {
    super(
      'suggestions',
      'id',
      'version',
      CreateSuggestionDataSchema,
      PartialSuggestionSchema,
      {
        storyIdColumnName: 'storyId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      }
    );
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const validatedData: CreateSuggestionDataType = this.createSchema.parse(update.data);

    // Check for existing suggestion with the same type and value within the same story
    const existingSuggestion = await db.query.suggestions.findFirst({
      where: and(
        eq(suggestions.storyId, storyId),
        eq(suggestions.type, validatedData.type),
        eq(suggestions.value, validatedData.value),
        eq(suggestions.isDeleted, false)
      ),
    });

    if (existingSuggestion) {
      throw new Error(`Conflict: Suggestion with type "${validatedData.type}" and value "${validatedData.value}" already exists in story ${storyId}.`);
    }

    await db.insert(suggestions).values({
      id: update.id!,
      storyId: storyId,
      type: validatedData.type,
      value: validatedData.value,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      isDeleted: false,
      deletedAt: null,
    });
  }

  async update(userId: string, storyId: string, update: UpdateStoryUpdate, currentEntity: any): Promise<void> {
    const validatedChanges = this.updateSchema.parse(update.changes);

    // If type or value are being updated, check for uniqueness within the story
    if (
      (validatedChanges.type && validatedChanges.type !== currentEntity.type) ||
      (validatedChanges.value && validatedChanges.value !== currentEntity.value)
    ) {
      const newType = validatedChanges.type || currentEntity.type;
      const newValue = validatedChanges.value || currentEntity.value;

      const existingSuggestion = await db.query.suggestions.findFirst({
        where: and(
          eq(suggestions.storyId, storyId),
          eq(suggestions.type, newType),
          eq(suggestions.value, newValue),
          eq(suggestions.isDeleted, false),
          eq(suggestions.id, update.id!) // Exclude the current suggestion from the check
        ),
      });

      if (existingSuggestion) {
        throw new Error(`Conflict: Suggestion with type "${newType}" and value "${newValue}" already exists in story ${storyId}.`);
      }
    }

    await super.update(userId, storyId, update, currentEntity);
  }

  async delete(userId: string, storyId: string, update: DeleteStoryUpdate, currentEntity: any): Promise<void> {
    await super.delete(userId, storyId, update, currentEntity);
  }
}
