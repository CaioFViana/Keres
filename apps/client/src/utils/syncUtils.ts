import { StoryUpdateType } from '@keres/shared';
import { eq } from 'drizzle-orm'; // Import eq
import { AppDrizzleClient } from '../db';
import * as schema from '../db/schema'; // Import all schema
import { ServerService } from '../services/ServerService'; // Import ServerService
import { createULID } from './ulid';

export async function recordLocalOperation(
  db: AppDrizzleClient,
  storyId: string,
  userId: string,
  operationType: StoryUpdateType,
  entityType: string,
  entityId: string,
  payload: Record<string, any>
): Promise<void> {
  if (!db) {
    console.error('recordLocalOperation: Drizzle client (db) not set.');
    return;
  }

  // Get the current local max operation version for this story
  const currentStory = await db.query.stories.findFirst({
    where: (stories, { eq }) => eq(stories.id, storyId),
    columns: { lastOperationLog: true },
  });

  const nextOperationVersion = (currentStory?.lastOperationLog || 0) + 1;

  // Insert into operationLogs
  await db.insert(schema.operationLogs).values({
    id: createULID(),
    storyId: storyId,
    userId: userId,
    operationVersion: nextOperationVersion,
    operationType: operationType,
    entityType: entityType,
    entityId: entityId,
    payload: JSON.stringify(payload), // Store payload as JSON string
    createdAt: new Date(),
    isSynced: false,
    serverOperationVersion: 0,
  });

  // Update the story's lastOperationLog
  await db.update(schema.stories)
    .set({ lastOperationLog: nextOperationVersion, updatedAt: new Date() }) // Also update updatedAt
    .where(eq(schema.stories.id, storyId));

  console.log(`Recorded local operation: ${operationType} ${entityType} ${entityId} for story ${storyId}, version ${nextOperationVersion}`);
}

export async function getUserIdForOperation(
  db: AppDrizzleClient,
  serverService: ServerService,
  storyId: string,
  currentLocalUserId: string
): Promise<string> {
  const story = await db.query.stories.findFirst({
    where: (stories, { eq }) => eq(stories.id, storyId),
    columns: { serverId: true },
  });

  if (story?.serverId) {
    const server = await serverService.getServerById(story.serverId);
    if (server?.idUser) {
      return server.idUser;
    }
  }
  return currentLocalUserId;
}