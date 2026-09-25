import type { StoryUpdateType } from '@keres/shared';
import { and, desc, eq, inArray, isNull, lte, ne, or } from 'drizzle-orm';
import type { AppDrizzleClient } from '../db';
import * as schema from '../db/schema';
import type { ServerService } from '../services/ServerService';
import { entityEventEmitter } from './EventEmitter';
import i18n from './i18n';
import { createULID } from './entityUtils';
import { withOpLogLock } from './opLogMutex';

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

/**
 * Appends one entry to the story's local op-log queue and bumps the story's
 * `lastOperationLog` to the entry's version, so versions stay a dense per-story sequence
 * the sync code can resume from. Entries start unsynced (`isSynced: false`,
 * `serverOperationVersion: 0`) with the payload stored stringified. Callers must run the
 * `assertStoryIsWritable`/`assertStoryIsOwned` gates *before* their table write - by the
 * time this runs, the local row already exists.
 */
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

  // Serialized per story: without the lock two concurrent writers read the same
  // counter and insert the same operationVersion (shared with recordRebasedOperation).
  const nextOperationVersion = await withOpLogLock(storyId, async () => {
    // Get the current local max operation version for this story
    const currentStory = await db.query.stories.findFirst({
      where: (stories, { eq }) => eq(stories.id, storyId),
      columns: { lastOperationLog: true },
    });

    const next = (currentStory?.lastOperationLog || 0) + 1;

    // Insert into operationLogs
    await db.insert(schema.operationLogs).values({
      id: createULID(),
      storyId: storyId,
      userId: userId,
      operationVersion: next,
      operationType: operationType,
      entityType: entityType,
      entityId: entityId,
      payload: JSON.stringify(payload),
      createdAt: new Date(),
      isSynced: false,
      serverOperationVersion: 0,
    });

    // Update the story's lastOperationLog
    await db
      .update(schema.stories)
      .set({ lastOperationLog: next, updatedAt: new Date() })
      .where(eq(schema.stories.id, storyId));

    return next;
  });

  // Without this, a local edit's own operation log row doesn't show up in the Operation Log
  // screen until it's unmounted and remounted (e.g. leaving and re-entering the story) - this
  // event was only ever emitted from the remote-pull/push-result side of SyncEngineService,
  // never from the local write path that creates the entry in the first place.
  entityEventEmitter.emit('operation_log_updated', storyId);

  console.log(
    `Recorded local operation: ${operationType} ${entityType} ${entityId} for story ${storyId}, version ${nextOperationVersion}`,
  );
}

/**
 * How many synchronized operations a story keeps on the device. Everything still waiting for the
 * server is always kept (it is the pending queue, not history), and so is every operation carrying
 * a conflict state - trimming those would destroy the evidence the conflict screen needs.
 */
export const MAX_RETAINED_SYNCED_OPERATIONS = 100;

/**
 * Drops synchronized, conflict-free history beyond the newest `keep` operations for one story.
 * Runs after a successful push; without it the local log grows forever (one row per save), and
 * with scene prose in the payloads that growth stops being negligible.
 *
 * Ordered by `serverOperationVersion` - when the server accepted the row - never by the local
 * `operationVersion` or `createdAt`. The local counter and the server's versions are different
 * spaces (a resend can sync an old counter late, and idempotent no-ops report version 0), so
 * ordering by the counter could trim an op the next pull still needs for its echo check while
 * keeping a newer-looking but older-accepted one. The server version is the comparable recency
 * key; no-op 0s (which no pull can ever carry) and version-less rows sort first and trim first,
 * and the local counter only breaks ties deterministically. `createdAt` stays out because the
 * SQLite timestamp column only has second precision, so two saves in the same second could tie.
 *
 * Only rows at or below the pull cursor are eligible at all: a synced op past the cursor has not
 * had its echo delivered yet (a blocked pull keeps pushing while starving the pull), and trimming
 * it would make the echo arrive as a foreign operation - re-applying a reorder, which bumps
 * versions instead of setting them. Favorites additionally wait for the public-favorites cursor,
 * since the historical path can deliver them after the main cursor has passed.
 *
 * @returns how many rows were removed.
 */
export async function trimSyncedOperationLogs(
  db: AppDrizzleClient,
  storyId: string,
  keep: number = MAX_RETAINED_SYNCED_OPERATIONS,
): Promise<number> {
  if (!db) {
    console.error('trimSyncedOperationLogs: Drizzle client (db) not set.');
    return 0;
  }

  const story = await db.query.stories.findFirst({
    where: eq(schema.stories.id, storyId),
    columns: { lastServerSyncedLog: true, lastPublicFavoriteLog: true },
  });
  const mainCursor = story?.lastServerSyncedLog ?? 0;
  const favoriteCursor = Math.min(mainCursor, story?.lastPublicFavoriteLog ?? 0);

  const synced = await db.query.operationLogs.findMany({
    where: and(
      eq(schema.operationLogs.storyId, storyId),
      eq(schema.operationLogs.isSynced, true),
      isNull(schema.operationLogs.conflictState),
      or(
        isNull(schema.operationLogs.serverOperationVersion),
        and(
          ne(schema.operationLogs.entityType, 'Favorite'),
          lte(schema.operationLogs.serverOperationVersion, mainCursor),
        ),
        and(
          eq(schema.operationLogs.entityType, 'Favorite'),
          lte(schema.operationLogs.serverOperationVersion, favoriteCursor),
        ),
      ),
    ),
    columns: { id: true },
    orderBy: [
      desc(schema.operationLogs.serverOperationVersion),
      desc(schema.operationLogs.operationVersion),
    ],
  });
  const stale = synced.slice(keep);
  if (stale.length === 0) {
    return 0;
  }
  await db.delete(schema.operationLogs).where(
    inArray(
      schema.operationLogs.id,
      stale.map((row) => row.id),
    ),
  );
  return stale.length;
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
