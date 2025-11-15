import { and, eq, max, sql } from 'drizzle-orm'; // Import 'sql' for incrementing version
import { ulid } from 'ulid';
import { db } from '../db';
import { characters, operationLog, operationTypeEnum, stories } from '../db/schema'; // Import 'characters'
import { CreateStoryUpdate, DeleteStoryUpdate, StoryUpdate, UpdateStoryUpdate } from '../schemas/SyncSchemas';

export class SyncService {
  async processAndRecordUpdates(userId: string, storyId: string, updates: StoryUpdate[]): Promise<{ lastOperationVersion: number }> {
    // Authorization check: Verify story ownership
    const story = await db.query.stories.findFirst({
      where: and(eq(stories.id, storyId), eq(stories.userId, userId)),
    });

    if (!story) {
      throw new Error('Unauthorized: Story not found or not owned by user.');
    }

    // TODO: Implement StoryPermissions check here if collaborative editing is enabled
    // For now, only owner can sync.

    const operationsToInsert = [];
    let currentMaxOperationVersion = (await db
      .select({ maxVersion: max(operationLog.operationVersion) })
      .from(operationLog)
      .where(eq(operationLog.storyId, storyId))
    ).at(0)?.maxVersion || 0;

    for (const update of updates) {
      currentMaxOperationVersion++;

      // Determine the original payload based on the update type for operation log
      let originalPayload: Record<string, any> = {};
      if (update.type === 'create') {
        originalPayload = (update as CreateStoryUpdate).data;
      } else if (update.type === 'update') {
        originalPayload = (update as UpdateStoryUpdate).changes;
      } else if (update.type === 'delete') {
        originalPayload = { id: update.id }; // For delete, store the ID of the deleted entity
      }

      // --- Entity Processing and Conflict Resolution ---
      if (update.entity === 'Story') {
        const currentStory = await db.query.stories.findFirst({
          where: eq(stories.id, update.id!),
        });

        if (update.type === 'create') {
          // If story already exists, it's a conflict
          if (currentStory) {
            throw new Error(`Conflict: Story with ID ${update.id} already exists.`);
          }
          await db.insert(stories).values({
            id: update.id!,
            userId: userId, // Assign to the user making the request
            title: (update as CreateStoryUpdate).data.title,
            type: (update as CreateStoryUpdate).data.type,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            // Other fields will be default or null
          });
        } else if (update.type === 'update') {
          if (!currentStory) {
            throw new Error(`Not Found: Story with ID ${update.id} does not exist.`);
          }
          // Conflict resolution: Last-Write-Wins based on version
          if ((update as UpdateStoryUpdate).changes.version < currentStory.version) {
            throw new Error(`Conflict: Story ${update.id} is outdated. Client version ${
              (update as UpdateStoryUpdate).changes.version
            } < Server version ${currentStory.version}.`);
          }
          await db.update(stories)
            .set({
              ...((update as UpdateStoryUpdate).changes as Partial<typeof stories.$inferInsert>),
              version: sql`${stories.version} + 1`, // Increment server version
              updatedAt: new Date(),
            })
            .where(eq(stories.id, update.id!));
        } else if (update.type === 'delete') {
          if (!currentStory) {
            throw new Error(`Not Found: Story with ID ${update.id} does not exist.`);
          }
          // Conflict resolution: Last-Write-Wins based on version
          if ((update as DeleteStoryUpdate).version! < currentStory.version) {
            throw new Error(`Conflict: Story ${update.id} is outdated. Client version ${
              (update as DeleteStoryUpdate).version
            } < Server version ${currentStory.version}.`);
          }
          await db.update(stories)
            .set({
              isDeleted: true,
              deletedAt: new Date(),
              version: sql`${stories.version} + 1`, // Increment server version
              updatedAt: new Date(),
            })
            .where(eq(stories.id, update.id!));
        }
      } else if (update.entity === 'Character') {
        const currentCharacter = await db.query.characters.findFirst({
          where: eq(characters.id, update.id!),
        });

        if (update.type === 'create') {
          if (currentCharacter) {
            throw new Error(`Conflict: Character with ID ${update.id} already exists.`);
          }
          await db.insert(characters).values({
            id: update.id!,
            storyId: storyId, // Character must belong to this story
            name: (update as CreateStoryUpdate).data.name,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            // Other fields will be default or null
          });
        } else if (update.type === 'update') {
          if (!currentCharacter) {
            throw new Error(`Not Found: Character with ID ${update.id} does not exist.`);
          }
          if ((update as UpdateStoryUpdate).changes.version < currentCharacter.version) {
            throw new Error(`Conflict: Character ${update.id} is outdated. Client version ${
              (update as UpdateStoryUpdate).changes.version
            } < Server version ${currentCharacter.version}.`);
          }
          await db.update(characters)
            .set({
              ...((update as UpdateStoryUpdate).changes as Partial<typeof characters.$inferInsert>),
              version: sql`${characters.version} + 1`,
              updatedAt: new Date(),
            })
            .where(eq(characters.id, update.id!));
        } else if (update.type === 'delete') {
          if (!currentCharacter) {
            throw new Error(`Not Found: Character with ID ${update.id} does not exist.`);
          }
          if ((update as DeleteStoryUpdate).version! < currentCharacter.version) {
            throw new Error(`Conflict: Character ${update.id} is outdated. Client version ${
              (update as DeleteStoryUpdate).version
            } < Server version ${currentCharacter.version}.`);
          }
          await db.update(characters)
            .set({
              isDeleted: true,
              deletedAt: new Date(),
              version: sql`${characters.version} + 1`,
              updatedAt: new Date(),
            })
            .where(eq(characters.id, update.id!));
        }
      }
      // --- End Entity Processing ---

      operationsToInsert.push({
        id: ulid(),
        storyId: storyId,
        operationVersion: currentMaxOperationVersion,
        operationType: operationTypeEnum.enumValues.includes(update.type as any) ? update.type as any : 'update',
        entityType: update.entity,
        entityId: update.id || ulid(),
        payload: originalPayload, // Store the original payload
        createdAt: new Date(),
      });
    }

    if (operationsToInsert.length > 0) {
      await db.insert(operationLog).values(operationsToInsert);
    }

    return { lastOperationVersion: currentMaxOperationVersion };
  }

  async getUpdatesForStory(userId: string, storyId: string, lastOperationVersion: number): Promise<StoryUpdate[]> {
    // Authorization check: Verify story ownership
    const story = await db.query.stories.findFirst({
      where: and(eq(stories.id, storyId), eq(stories.userId, userId)),
    });

    if (!story) {
      throw new Error('Unauthorized: Story not found or not owned by user.');
    }

    // TODO: Implement StoryPermissions check here if collaborative editing is enabled
    // For now, only owner can sync.

    // TODO: Implement logic to fetch updates from the operationLog table
    // for the given storyId and where operationVersion > lastOperationVersion.
    // For now, return an empty array.
    console.log(`Fetching updates for storyId: ${storyId} since operationVersion: ${lastOperationVersion}`);
    return [];
  }
}

export const syncService = new SyncService();
