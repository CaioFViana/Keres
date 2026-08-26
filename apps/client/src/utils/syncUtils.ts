import type { StoryUpdateType } from '@keres/shared';
import { eq } from 'drizzle-orm'; // Import eq
import type { AppDrizzleClient } from '../db';
import * as schema from '../db/schema'; // Import all schema
import type { ServerService } from '../services/ServerService'; // Import ServerService
import { entityEventEmitter } from './EventEmitter';
import i18n from './i18n';
import { createULID } from './entityUtils';

/** Thrown when a story-content mutation is attempted by a user with only reader access. */
export class StoryReadOnlyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoryReadOnlyError';
  }
}

/**
 * Thrown when a writer (or anyone who is not the owner) tries to change story identity or
 * policy - `type`, `favoriteBehavior`, `allowReaderComments` - or to delete / unlink the
 * story. Mirrors the server's owner-only gate so those mutations never land locally and then
 * bounce as `unauthorized` on every push.
 */
export class StoryOwnerOnlyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoryOwnerOnlyError';
  }
}

/**
 * Refuses a mutation before it ever reaches the entity table or the op-log queue, mirroring
 * the server's write-permission gate (`SyncService.processAndRecordUpdates`). Without this,
 * a reader's local write succeeds instantly (optimistic local-first UX), then gets rejected by
 * the server on every sync retry forever - this catches it up front instead. Must be called by
 * each entity service *before* its table write, not from inside `recordLocalOperation` (which
 * only runs after the write already happened, too late to prevent an orphaned local row).
 */
export async function assertStoryIsWritable(db: AppDrizzleClient, storyId: string): Promise<void> {
  const story = await db.query.stories.findFirst({
    where: (stories, { eq }) => eq(stories.id, storyId),
    columns: { myRole: true, serverId: true },
  });
  // No serverId = never-linked local-only story = no collaborators possible = always writable.
  // Otherwise require a *positively known* owner/writer role - a story whose role hasn't
  // resolved yet (`myRole` still null, e.g. moments after it was first synced in as a
  // collaborator) fails closed instead of being silently treated as writable.
  if (story?.serverId && story.myRole !== 'owner' && story.myRole !== 'writer') {
    throw new StoryReadOnlyError(i18n.t('story_read_only_error'));
  }
}

/**
 * Same fail-closed idea as `assertStoryIsWritable`, but for operations the server only
 * accepts from the owner: converting type, changing favorite/comment policy, deleting the
 * story, unlinking it from the server. A never-linked local story has no collaborators, so
 * it is treated as owned. A linked story whose role hasn't resolved yet is not.
 */
export async function assertStoryIsOwned(db: AppDrizzleClient, storyId: string): Promise<void> {
  const story = await db.query.stories.findFirst({
    where: (stories, { eq }) => eq(stories.id, storyId),
    columns: { myRole: true, serverId: true },
  });
  if (story?.serverId && story.myRole !== 'owner') {
    throw new StoryOwnerOnlyError(i18n.t('story_owner_only_error'));
  }
}

export async function recordLocalOperation(
  db: AppDrizzleClient,
  storyId: string,
  userId: string,
  operationType: StoryUpdateType,
  entityType: string,
  entityId: string,
  payload: Record<string, any>,
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
  await db
    .update(schema.stories)
    .set({ lastOperationLog: nextOperationVersion, updatedAt: new Date() }) // Also update updatedAt
    .where(eq(schema.stories.id, storyId));

  // Without this, a local edit's own operation log row doesn't show up in the Operation Log
  // screen until it's unmounted and remounted (e.g. leaving and re-entering the story) - this
  // event was only ever emitted from the remote-pull/push-result side of SyncEngineService,
  // never from the local write path that creates the entry in the first place.
  entityEventEmitter.emit('operation_log_updated', storyId);

  console.log(
    `Recorded local operation: ${operationType} ${entityType} ${entityId} for story ${storyId}, version ${nextOperationVersion}`,
  );
}

export async function getUserIdForOperation(
  db: AppDrizzleClient,
  serverService: ServerService,
  storyId: string,
  currentLocalUserId: string,
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
