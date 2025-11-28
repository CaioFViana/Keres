import { CreateStoryUpdate, DeleteStoryUpdate, StoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { and, eq, gt, max, or } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db } from '../db';
import { operationLog, operationTypeEnum, stories, storyPermissions } from '../db/schema';
import { eventManager } from '../utils/EventManager'; // Import eventManager
import { SyncEntityHandler } from './entity-sync-handlers/BaseSyncEntityHandler';
import { ChapterSyncHandler } from './entity-sync-handlers/ChapterSyncHandler';
import { CharacterRelationSyncHandler } from './entity-sync-handlers/CharacterRelationSyncHandler';
import { CharacterSceneSyncHandler } from './entity-sync-handlers/CharacterSceneSyncHandler';
import { CharacterSyncHandler } from './entity-sync-handlers/CharacterSyncHandler';
import { ChoiceSyncHandler } from './entity-sync-handlers/ChoiceSyncHandler';
import { GallerySyncHandler } from './entity-sync-handlers/GallerySyncHandler';
import { ItemJourneySyncHandler } from './entity-sync-handlers/ItemJourneySyncHandler';
import { ItemSyncHandler } from './entity-sync-handlers/ItemSyncHandler';
import { LocationSyncHandler } from './entity-sync-handlers/LocationSyncHandler';
import { NoteSyncHandler } from './entity-sync-handlers/NoteSyncHandler';
import { SceneSyncHandler } from './entity-sync-handlers/SceneSyncHandler';
import { StorySyncHandler } from './entity-sync-handlers/StorySyncHandler';
import { SuggestionSyncHandler } from './entity-sync-handlers/SuggestionSyncHandler';
import { TagRelationSyncHandler } from './entity-sync-handlers/TagRelationSyncHandler';
import { TagSyncHandler } from './entity-sync-handlers/TagSyncHandler';
import { WorldRuleSyncHandler } from './entity-sync-handlers/WorldRuleSyncHandler';
import { storyPermissionService } from './StoryPermissionService';

export class SyncService {
  private entityHandlers: Map<string, SyncEntityHandler>;

  constructor() {
    this.entityHandlers = new Map<string, SyncEntityHandler>();
    this.registerEntityHandler(new StorySyncHandler());
    this.registerEntityHandler(new CharacterSyncHandler());
    this.registerEntityHandler(new ChapterSyncHandler());
    this.registerEntityHandler(new LocationSyncHandler());
    this.registerEntityHandler(new SceneSyncHandler());
    this.registerEntityHandler(new GallerySyncHandler());
    this.registerEntityHandler(new NoteSyncHandler());
    this.registerEntityHandler(new WorldRuleSyncHandler());
    this.registerEntityHandler(new ChoiceSyncHandler());
    this.registerEntityHandler(new CharacterSceneSyncHandler());
    this.registerEntityHandler(new CharacterRelationSyncHandler());
    this.registerEntityHandler(new ItemSyncHandler());
    this.registerEntityHandler(new ItemJourneySyncHandler());
    this.registerEntityHandler(new SuggestionSyncHandler());
    this.registerEntityHandler(new TagSyncHandler());
    this.registerEntityHandler(new TagRelationSyncHandler())
  }

  private registerEntityHandler(handler: SyncEntityHandler) {
    this.entityHandlers.set(handler.entityName, handler);
  }

  async processAndRecordUpdates(userId: string, storyId: string, updates: StoryUpdate[]): Promise<{ lastOperationVersion: number }> {
    // Authorization check
    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
    });

    if (!story) {
      throw new Error('Story not found.');
    }

    let hasWritePermission = false;
    if (story.userId === userId) {
      hasWritePermission = true; // User is the owner
    } else {
      const permission = await storyPermissionService.getUserPermissionForStory(userId, storyId);
      if (permission && permission.permissionType === 'writer') {
        hasWritePermission = true;
      }
    }

    if (!hasWritePermission) {
      throw new Error('Unauthorized: User does not have write permission for this story.');
    }

    const operationsToInsert = [];
    let currentMaxOperationVersion = (await db
      .select({ maxVersion: max(operationLog.operationVersion) })
      .from(operationLog)
      .where(eq(operationLog.storyId, storyId))
    ).at(0)?.maxVersion || 0;

    for (const update of updates) {
      currentMaxOperationVersion++;

      const handler = this.entityHandlers.get(update.entity);
      if (!handler) {
        throw new Error(`No sync handler registered for entity type: ${update.entity}`);
      }

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
      const currentEntity = await handler.findById(update.id!);

      // Check if the entity belongs to the story (if applicable)
      if (currentEntity && !handler.checkBelongsToStory(currentEntity, storyId)) {
        throw new Error(`Unauthorized: Entity ${update.id} does not belong to story ${storyId}.`);
      }

      // Check if the user has permission to modify this entity (if applicable)
      // This check is primarily for entities that might have their own userId,
      // separate from the story owner (e.g., if a user can own a specific character within a shared story).
      // For now, we rely on the story-level write permission.
      // if (currentEntity && !handler.checkOwnership(currentEntity, userId)) {
      //   throw new Error(`Unauthorized: User ${userId} does not own entity ${update.id}.`);
      // }

      if (update.type === 'create') {
        await handler.create(userId, storyId, update as CreateStoryUpdate);
      } else if (update.type === 'update') {
        if (!currentEntity) {
          throw new Error(`Not Found: ${update.entity} with ID ${update.id} does not exist.`);
        }
        await handler.update(userId, storyId, update as UpdateStoryUpdate, currentEntity);
      } else if (update.type === 'delete') {
        if (!currentEntity) {
          throw new Error(`Not Found: ${update.entity} with ID ${update.id} does not exist.`);
        }
        await handler.delete(userId, storyId, update as DeleteStoryUpdate, currentEntity);
      }
      // --- End Entity Processing ---

      operationsToInsert.push({
        id: ulid(),
        storyId: storyId,
        userId: userId, // Add the userId here
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
      // Broadcast the updates to WebSocket clients subscribed to this storyId
      eventManager.emit(`storyUpdate:${storyId}`, {
        type: 'story_update',
        storyId: storyId,
        updates: operationsToInsert.length,
        originatingUser: userId,
      });
    }

    return { lastOperationVersion: currentMaxOperationVersion };
  }

  async getUpdatesForStory(userId: string, storyId: string, lastOperationVersion: number): Promise<StoryUpdate[]> {
    // Authorization check
    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
    });

    if (!story) {
      throw new Error('Story not found.');
    }

    let hasReadPermission = false;
    if (story.userId === userId) {
      hasReadPermission = true; // User is the owner
    } else {
      const permission = await storyPermissionService.getUserPermissionForStory(userId, storyId);
      if (permission && (permission.permissionType === 'reader' || permission.permissionType === 'writer')) {
        hasReadPermission = true;
      }
    }

    if (!hasReadPermission) {
      throw new Error('Unauthorized: User does not have read permission for this story.');
    }

    const fetchedOperations = await db.query.operationLog.findMany({
      where: and(
        eq(operationLog.storyId, storyId),
        gt(operationLog.operationVersion, lastOperationVersion)
      ),
      orderBy: [operationLog.operationVersion],
    });

    // Map operationLog entries back to StoryUpdate objects
    const updates: StoryUpdate[] = fetchedOperations.map(op => {
      let version: number | undefined;
      let data: Record<string, any> | undefined;
      let changes: Record<string, any> | undefined;

      // Explicitly cast op.payload to Record<string, any>
      const payloadAsRecord = op.payload as Record<string, any>;

      // Extract version and payload types correctly based on operationType
      if (op.operationType === 'create') {
        data = payloadAsRecord;
        version = payloadAsRecord.version; // Client should send version for create
      } else if (op.operationType === 'update') {
        changes = payloadAsRecord;
        version = payloadAsRecord.version; // Version is expected in changes
      } else if (op.operationType === 'delete') {
        // For delete, payload might only contain id, version might be part of the initial update object
        // If the client sends version with delete, it would be in update.version, not payload.
        // For now, we assume it might be in payload if client chose to send it.
        version = payloadAsRecord.version; // Placeholder, review client's DeleteStoryUpdate structure
      }

      // Reconstruct the StoryUpdate object
      if (op.operationType === 'create') {
        return {
          type: 'create',
          entity: op.entityType,
          id: op.entityId,
          data: data!,
          version: version,
        } as CreateStoryUpdate;
      } else if (op.operationType === 'update') {
        return {
          type: 'update',
          entity: op.entityType,
          id: op.entityId,
          changes: changes!,
          version: version,
        } as UpdateStoryUpdate;
      } else if (op.operationType === 'delete') {
        return {
          type: 'delete',
          entity: op.entityType,
          id: op.entityId,
          version: version, // This version property on DeleteStoryUpdate should come from the original client update
        } as DeleteStoryUpdate;
      }
      // Fallback or throw error for unknown operation types
      throw new Error(`Unknown operation type: ${op.operationType}`);
    });

    return updates;
  }

  async getStoriesWithLastOperationVersionForUser(userId: string): Promise<{ storyId: string; lastOperationVersion: number }[]> {
    const ownedStories = await db.query.stories.findMany({
      where: and(eq(stories.userId, userId), eq(stories.isDeleted, false)),
      columns: {
        id: true,
        version: true,
      },
    });

    const permittedStories = await db.query.storyPermissions.findMany({
      where: and(
        eq(storyPermissions.userId, userId),
        eq(storyPermissions.isDeleted, false),
        or(eq(storyPermissions.permissionType, 'reader'), eq(storyPermissions.permissionType, 'writer'))
      ),
      with: {
        story: {
          columns: {
            id: true,
            version: true,
            isDeleted: true,
          },
        },
      },
    });

    const storyMap = new Map<string, number>();

    ownedStories.forEach(story => {
      storyMap.set(story.id, story.version);
    });

    permittedStories.forEach(permission => {
      if (permission.story && !permission.story.isDeleted) {
        storyMap.set(permission.story.id, permission.story.version);
      }
    });

    return Array.from(storyMap.entries()).map(([storyId, lastOperationVersion]) => ({
      storyId,
      lastOperationVersion,
    }));
  }
}

export const syncService = new SyncService();
