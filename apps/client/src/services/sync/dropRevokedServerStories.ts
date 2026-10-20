import { and, eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '@/src/db';
import { stories } from '@/src/db/schema';
import type { ServerSelect } from '@/src/db/schema';
import { useNotificationStore } from '@/src/state/ui/notificationStore';
import { useStoryListStore } from '@/src/state/story/storyListStore';
import { entityEventEmitter } from '@/src/state/events/EventEmitter';
import i18n from '@/src/utils/format/i18n';
import { createStoryService } from '@/src/services/storymanagement/story-lifecycle/StoryService';
import {
  takeAccessRevocation,
  type AccessRevocationReason,
} from '@/src/services/social/accessRevocation';
import type { ServerStoryPreview } from '@/src/services/sync/SyncEngineService';
import { logger } from '@/src/utils/logging/logger';

const REVOCATION_MESSAGE_KEYS: Record<AccessRevocationReason, string> = {
  'nsfw-story': 'story_access_revoked_nsfw',
  'verification-revoked': 'story_access_revoked_verification',
  'account-deactivated': 'story_access_revoked_deactivated',
  'removed-by-admin': 'story_access_revoked_removed',
};

/**
 * Removes the local copy of every story this device holds as somebody else's collaborator that the
 * server no longer lists: the owner removed the person, or the friendship ended, or they left from
 * another device. Nothing else on the device would notice - the story would only keep failing its syncs
 * with 403.
 *
 * `previews` must be a list the server really answered: a failed request is not "no stories", and
 * acting on it would erase every shared story of a device that merely lost its connection. Only stories
 * of this server with a known non-owner role are touched - the owner's own stories, local ones and
 * those whose role has not resolved yet are never dropped here. Returns the ids removed.
 */
export async function dropRevokedServerStories(
  db: AppDrizzleClient,
  server: ServerSelect,
  previews: ServerStoryPreview[],
): Promise<string[]> {
  const readable = new Set(previews.map((preview) => preview.storyId));
  const linked = await db.query.stories.findMany({
    where: and(eq(stories.serverId, server.id)),
    columns: { id: true, title: true, myRole: true },
  });
  const revoked = linked.filter(
    (story) => (story.myRole === 'writer' || story.myRole === 'reader') && !readable.has(story.id),
  );
  if (revoked.length === 0) return [];

  const storyService = createStoryService(db);
  const dropped: string[] = [];
  for (const story of revoked) {
    try {
      await storyService.discardCollaboratedCopy(story.id);
      dropped.push(story.id);
      // A noted revocation (NSFW moderation, admin removal) names its reason; anything else
      // keeps the generic message - e.g. an unfriend, or a revocation from before this device
      // was online (realtime events are never redelivered).
      const reason = takeAccessRevocation(story.id);
      const key = reason ? REVOCATION_MESSAGE_KEYS[reason] : 'story_access_lost';
      useNotificationStore.getState().showNotification(i18n.t(key, { title: story.title }), 'info');
      // Whatever is showing it - the open story above all - lets go of it.
      entityEventEmitter.emit('story_access_lost', story.id);
    } catch (error) {
      logger.debug(`Failed to drop the copy of story ${story.id} after losing access:`, error);
    }
  }
  if (dropped.length > 0) {
    await useStoryListStore.getState().fetchStories(storyService);
  }
  return dropped;
}
