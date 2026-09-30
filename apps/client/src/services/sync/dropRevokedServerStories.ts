import { and, eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import { stories } from '../../db/schema';
import type { ServerSelect } from '../../db/schema';
import { useNotificationStore } from '../../state/notificationStore';
import { useStoryListStore } from '../../state/storyListStore';
import { entityEventEmitter } from '../../utils/EventEmitter';
import i18n from '../../utils/i18n';
import { createStoryService } from '../storymanagement/StoryService';
import type { ServerStoryPreview } from '../SyncEngineService';

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
      useNotificationStore
        .getState()
        .showNotification(i18n.t('story_access_lost', { title: story.title }), 'info');
      // Whatever is showing it - the open story above all - lets go of it.
      entityEventEmitter.emit('story_access_lost', story.id);
    } catch (error) {
      console.log(`Failed to drop the copy of story ${story.id} after losing access:`, error);
    }
  }
  if (dropped.length > 0) {
    await useStoryListStore.getState().fetchStories(storyService);
  }
  return dropped;
}
