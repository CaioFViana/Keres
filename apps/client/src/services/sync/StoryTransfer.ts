import type { EffectiveStoryRole } from '@keres/shared';
import { and, eq, lte } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import type { ServerSelect } from '../../db/schema';
import { useNotificationStore } from '../../state/notificationStore';
import i18n from '../../utils/i18n';
import { createKeresAxiosInstance } from '../apiClient';
import { authTokenManager } from '../AuthTokenManager';
import { createServerService } from '../ServerService';
import { createCommentService } from '../storymanagement/CommentService';
import { createFavoriteService } from '../storymanagement/FavoriteService';
import { createStoryService } from '../storymanagement/StoryService';

export interface ServerStoryPreview {
  storyId: string;
  lastOperationVersion: number;
  role: EffectiveStoryRole;
}

export type StoryUploadResult =
  | { success: true }
  | { success: false; reason: 'already_exists' | 'error'; message?: string };

export async function fetchServerStoryPreviews(
  server: ServerSelect,
): Promise<ServerStoryPreview[]> {
  if (!server?.url) {
    console.log('A server with a URL is required to fetch story previews.');
    return [];
  }

  const client = createKeresAxiosInstance({ baseURL: server.url });
  client.setTokenProvider(authTokenManager);
  client.setActiveServer(server);

  try {
    const response = await client.get<{
      message: string;
      storyPreviews: ServerStoryPreview[];
    }>('/sync/pullpreviews');
    return response.data.storyPreviews;
  } catch (error) {
    console.log(`Error fetching server story previews from ${server.url}:`, error);
    return [];
  }
}

export async function downloadAndImportStory(
  db: AppDrizzleClient | null,
  queriedServerId: string,
  storyId: string,
  userId: string,
  role: EffectiveStoryRole,
): Promise<void> {
  const { showNotification } = useNotificationStore.getState();
  if (!db) {
    showNotification(`Failed to download story '${storyId}': Database not set.`, 'error');
    return;
  }
  if (!queriedServerId) {
    showNotification(`Failed to download story '${storyId}': Server ID not set.`, 'error');
    return;
  }
  if (!userId) {
    showNotification(`Failed to download story '${storyId}': User ID not set.`, 'error');
    return;
  }

  let server: ServerSelect | undefined;
  try {
    server = await createServerService(db).getServerById(queriedServerId);
    if (!server?.url) {
      showNotification(
        `Failed to download story '${storyId}': Server URL not found for ID ${queriedServerId}.`,
        'error',
      );
      return;
    }
  } catch (error) {
    console.error('Error fetching server details by ID:', error);
    showNotification(
      `Failed to download story '${storyId}': Error retrieving server details.`,
      'error',
    );
    return;
  }

  const client = createKeresAxiosInstance({ baseURL: server.url });
  client.setTokenProvider(authTokenManager);
  client.setActiveServer(server);

  let storyTitle = storyId;
  try {
    const response = await client.get(`/stories/${storyId}/export`);
    const fullStoryData = response.data;
    storyTitle = fullStoryData?.story?.title || storyId;
    await createStoryService(db).importFullStory(userId, fullStoryData, queriedServerId, role);
    showNotification(i18n.t('story_downloaded_and_imported', { title: storyTitle }), 'success');
  } catch (error) {
    console.log(`Error downloading or importing story ${storyId} from ${server.url}:`, error);
    showNotification(i18n.t('failed_to_download_story_named', { title: storyTitle }), 'error');
  }
}

export async function uploadNewStoryToServer(
  db: AppDrizzleClient | null,
  storyId: string,
  server: ServerSelect,
  userId: string,
): Promise<StoryUploadResult> {
  if (!db) return { success: false, reason: 'error', message: 'Database not set.' };
  if (!server?.url) return { success: false, reason: 'error', message: 'Server URL not set.' };

  const client = createKeresAxiosInstance({ baseURL: server.url });
  client.setTokenProvider(authTokenManager);
  client.setActiveServer(server);

  try {
    const response = await client.get<{
      message: string;
      storyPreviews: ServerStoryPreview[];
    }>('/sync/pullpreviews');
    if (response.data.storyPreviews.some((preview) => preview.storyId === storyId)) {
      return { success: false, reason: 'already_exists' };
    }
  } catch (error) {
    console.log(`Error checking story existence on ${server.url}:`, error);
    return { success: false, reason: 'error', message: (error as Error)?.message };
  }

  const storyService = createStoryService(db);
  const story = await storyService.getStoryById(storyId);
  if (!story) {
    return { success: false, reason: 'error', message: `Story ${storyId} not found locally.` };
  }
  const storyExport = await storyService.exportFullStory(storyId);

  try {
    await client.post(`/stories/import?storyId=${encodeURIComponent(storyId)}`, storyExport);
  } catch (error) {
    console.log(`Error uploading story ${storyId} to ${server.url}:`, error);
    return { success: false, reason: 'error', message: (error as Error)?.message };
  }

  await createFavoriteService(db).migrateUserIdentity(storyId, userId, server.idUser);
  await createCommentService(db).migrateAuthorIdentity(storyId, userId, server.idUser);
  await db
    .update(schema.operationLogs)
    // The import is a snapshot: it already contains every local entity state represented by
    // operations up to this boundary. Leaving any of those operations pending makes the regular
    // sync push them a second time against rows the import has just created (Board was the first
    // visible casualty). Operations recorded after the snapshot remain pending and are sent
    // normally.
    .set({ isSynced: true })
    .where(
      and(
        eq(schema.operationLogs.storyId, storyId),
        lte(schema.operationLogs.operationVersion, story.lastOperationLog),
      ),
    );
  await storyService.updateStory(userId, storyId, {
    serverId: server.id,
    // Import writes a snapshot, not server operation-log rows. The server's next operation
    // therefore starts at 1; carrying the local operation counter into this cursor would skip
    // future remote updates forever.
    lastServerSyncedLog: 0,
    lastPublicFavoriteLog: 0,
    myRole: 'owner',
  });

  return { success: true };
}
