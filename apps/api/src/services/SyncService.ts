import type { EffectiveStoryRole, StoryUpdate } from '@keres/shared';
import { and, eq, or } from 'drizzle-orm';
import { db } from '../db';
import { stories, storyPermissions } from '../db/schema';
import type { SyncEntityHandler } from './entity-sync-handlers/BaseSyncEntityHandler';
import { registerApiSyncHandlers } from './entity-sync-handlers/registerApiSyncHandlers';
import { SyncOperationLogService } from './sync/SyncOperationLogService';
import { SyncPullService } from './sync/SyncPullService';
import { SyncPushService } from './sync/SyncPushService';

/**
 * Public API facade for synchronization. It owns the API handler registry and keeps the stable
 * entry points used by routes and recovery code; push, pull, and operation-log persistence live in
 * dedicated services so protocol coordination does not turn into entity-specific logic here.
 */
export class SyncService {
  private entityHandlers: Map<string, SyncEntityHandler>;
  private operationLogService: SyncOperationLogService;
  private pullService: SyncPullService;
  private pushService: SyncPushService;

  constructor() {
    this.entityHandlers = registerApiSyncHandlers();
    this.operationLogService = new SyncOperationLogService(this.entityHandlers);
    this.pullService = new SyncPullService();
    this.pushService = new SyncPushService(this.entityHandlers, (args) =>
      this.appendOperationLog(args),
    );
  }

  /** Exposto para AdminRecoveryService (restaurar entidades) e TierEnforcementService (contar uso). */
  getEntityHandlers(): ReadonlyMap<string, SyncEntityHandler> {
    return this.entityHandlers;
  }

  /** Delegates transactional batch application to the sync protocol write coordinator. */
  async processAndRecordUpdates(userId: string, storyId: string, updates: StoryUpdate[]) {
    return this.pushService.processAndRecordUpdates(userId, storyId, updates);
  }

  /** Public for recovery operations; the implementation owns the story-local atomic counter. */
  async appendOperationLog(args: {
    storyId: string;
    userId: string;
    update: StoryUpdate;
    entityId: string;
    entityVersion?: number;
  }): Promise<{ id: string; operationVersion: number }> {
    return this.operationLogService.append(args);
  }

  async getUpdatesForStory(
    userId: string,
    storyId: string,
    lastOperationVersion: number,
    lastPublicFavoriteVersion = 0,
  ) {
    return this.pullService.getUpdatesForStory(
      userId,
      storyId,
      lastOperationVersion,
      lastPublicFavoriteVersion,
    );
  }

  async getStoriesWithLastOperationVersionForUser(
    userId: string,
  ): Promise<{ storyId: string; lastOperationVersion: number; role: EffectiveStoryRole }[]> {
    const ownedStories = await db.query.stories.findMany({
      where: and(eq(stories.userId, userId), eq(stories.isDeleted, false)),
      columns: {
        id: true,
        lastOperationVersion: true,
      },
    });

    const permittedStories = await db.query.storyPermissions.findMany({
      where: and(
        eq(storyPermissions.userId, userId),
        eq(storyPermissions.isDeleted, false),
        or(
          eq(storyPermissions.permissionType, 'reader'),
          eq(storyPermissions.permissionType, 'writer'),
        ),
      ),
      with: {
        story: {
          columns: {
            id: true,
            lastOperationVersion: true,
            isDeleted: true,
          },
        },
      },
    });

    /**
     * Carries role alongside version, not just version: the client persists this role into its
     * local `stories.myRole` column the moment it creates the row for a story it just learned
     * about (see `StoryService.importFullStory`), so there's never a window where the row exists
     * server-linked but with an unknown role that a permissive default could mistake for owner.
     */
    const storyMap = new Map<string, { lastOperationVersion: number; role: EffectiveStoryRole }>();

    ownedStories.forEach((story) => {
      storyMap.set(story.id, {
        lastOperationVersion: story.lastOperationVersion,
        role: 'owner',
      });
    });

    permittedStories.forEach((permission) => {
      if (permission.story && !permission.story.isDeleted) {
        storyMap.set(permission.story.id, {
          lastOperationVersion: permission.story.lastOperationVersion,
          role: permission.permissionType,
        });
      }
    });

    return Array.from(storyMap.entries()).map(([storyId, { lastOperationVersion, role }]) => ({
      storyId,
      lastOperationVersion,
      role,
    }));
  }
}

export const syncService = new SyncService();
