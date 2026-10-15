import type { EffectiveStoryRole } from '@keres/shared';
import { and, eq, lte } from 'drizzle-orm';
import type { AppDrizzleClient } from '@/src/db';
import * as schema from '@/src/db/schema';
import type { ServerSelect } from '@/src/db/schema';
import i18n from '@/src/utils/format/i18n';
import { createKeresAxiosInstance } from '@/src/services/apiClient';
import { authTokenManager } from '@/src/services/AuthTokenManager';
import { createServerService } from '@/src/services/ServerService';
import { createCommentService } from '@/src/services/storymanagement/CommentService';
import { createFavoriteService } from '@/src/services/storymanagement/FavoriteService';
import { createStoryService } from '@/src/services/storymanagement/StoryService';
import type { SyncNotifier } from './SyncNotifier';

export interface ServerStoryPreview {
  storyId: string;
  lastOperationVersion: number;
  role: EffectiveStoryRole;
}

export type StoryUploadResult =
  | { success: true }
  | { success: false; reason: 'already_exists' | 'error'; message?: string }
  /** The story was on this server before and unlinked; the server keeps the old data until the owner agrees to replace it. */
  | { success: false; reason: 'previously_on_server' }
  /**
   * The server said no on purpose and gave the reason. `planLimit` is true only when the refusal is a plan's ceiling
   * (see `isPlanLimitMessage`): the plan hint must not be attached to any other refusal, such as the adults-only one.
   */
  | { success: false; reason: 'refused'; message: string; planLimit: boolean };

/**
 * What the server lets this user read, or `null` when it could not be asked. The difference matters to
 * whoever acts on the absence of a story: an unreachable server has not revoked anything.
 */
export async function fetchServerStoryPreviewsOrNull(
  server: ServerSelect,
): Promise<ServerStoryPreview[] | null> {
  if (!server?.url) {
    console.log('A server with a URL is required to fetch story previews.');
    return null;
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
    return null;
  }
}

export async function fetchServerStoryPreviews(
  server: ServerSelect,
): Promise<ServerStoryPreview[]> {
  return (await fetchServerStoryPreviewsOrNull(server)) ?? [];
}

export async function downloadAndImportStory(
  db: AppDrizzleClient | null,
  queriedServerId: string,
  storyId: string,
  userId: string,
  role: EffectiveStoryRole,
  notifier: SyncNotifier,
): Promise<void> {
  if (!db) {
    notifier.message(`Failed to download story '${storyId}': Database not set.`, 'error');
    return;
  }
  if (!queriedServerId) {
    notifier.message(`Failed to download story '${storyId}': Server ID not set.`, 'error');
    return;
  }
  if (!userId) {
    notifier.message(`Failed to download story '${storyId}': User ID not set.`, 'error');
    return;
  }

  let server: ServerSelect | undefined;
  try {
    server = await createServerService(db).getServerById(queriedServerId);
    if (!server?.url) {
      notifier.message(
        `Failed to download story '${storyId}': Server URL not found for ID ${queriedServerId}.`,
        'error',
      );
      return;
    }
  } catch (error) {
    console.error('Error fetching server details by ID:', error);
    notifier.message(
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
    notifier.message(i18n.t('story_downloaded_and_imported', { title: storyTitle }), 'success');
  } catch (error) {
    console.log(`Error downloading or importing story ${storyId} from ${server.url}:`, error);
    notifier.message(i18n.t('failed_to_download_story_named', { title: storyTitle }), 'error');
  }
}

/** The machine-readable code a 403 carried, when it carried one (the server names a plan ceiling `tier_limit`). */
function serverRefusalCode(error: unknown): string | null {
  const code = (error as { response?: { data?: { code?: unknown } } })?.response?.data?.code;
  return typeof code === 'string' ? code : null;
}

/** What a 409 carries when the story being sent was unlinked from the server earlier (the API's `STORY_PREVIOUSLY_ON_SERVER`). */
function wasPreviouslyOnServer(error: unknown): boolean {
  const response = (error as { response?: { status?: number; data?: { code?: unknown } } })
    ?.response;
  return response?.status === 409 && response.data?.code === 'STORY_PREVIOUSLY_ON_SERVER';
}

/** The reason the server gave for refusing (403) a request, when it gave one: its limits speak for themselves. */
function serverRefusalMessage(error: unknown): string | null {
  const response = (error as { response?: { status?: number; data?: { message?: unknown } } })
    ?.response;
  if (response?.status !== 403) return null;
  const message = response.data?.message;
  return typeof message === 'string' && message.trim() ? message : null;
}

/**
 * Whether a 403 message is a plan's ceiling. The API's tier refusals (`TierLimitExceededError`, re-thrown as a plain
 * 403 by the story import) name the plan in their text ("Story limit reached for your plan (1)."), and the import
 * route sends no machine-readable code for them. So the words are the only sign available: the check is strict on
 * purpose, and a message that does not say "your plan" gets no plan hint. Other 403s (adults-only, showcase) never do.
 */
export function isPlanLimitMessage(message: string): boolean {
  return /\byour plan\b/i.test(message);
}

export async function uploadNewStoryToServer(
  db: AppDrizzleClient | null,
  storyId: string,
  server: ServerSelect,
  userId: string,
  options: { replaceOldCopy?: boolean } = {},
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
  // The identity migration must precede the export: the server stores the snapshot verbatim
  // (no operation rows, and `userId`/`authorUserId` are immutable afterwards), so exporting
  // first would freeze the uploader's meaningless local id into every favorite/comment on the
  // server while the local rows move to the server id - a second device would download
  // ghost-owned rows it can never match, and public stories would show ghost favoritists.
  await createFavoriteService(db).migrateUserIdentity(storyId, userId, server.idUser);
  await createCommentService(db).migrateAuthorIdentity(storyId, userId, server.idUser);
  const storyExport = await storyService.exportFullStory(storyId);

  try {
    // `replaceUnlinked` is the owner's agreement that what the server still keeps of this story, from before it
    // was unlinked, is erased first.
    const replace = options.replaceOldCopy ? '&replaceUnlinked=true' : '';
    await client.post(
      `/stories/import?storyId=${encodeURIComponent(storyId)}${replace}`,
      storyExport,
    );
  } catch (error) {
    console.log(`Error uploading story ${storyId} to ${server.url}:`, error);
    // The story stays unlinked, so reads resolve to the local id again: migrate back so the
    // owner's favorites/comments do not sit invisible under the server id after a failed
    // upload. Best effort - a retry migrates forward again anyway.
    await createFavoriteService(db).migrateUserIdentity(storyId, server.idUser, userId);
    await createCommentService(db).migrateAuthorIdentity(storyId, server.idUser, userId);
    if (wasPreviouslyOnServer(error)) return { success: false, reason: 'previously_on_server' };
    const refusal = serverRefusalMessage(error);
    if (refusal)
      return {
        success: false,
        reason: 'refused',
        message: refusal,
        // The server's own code first; the words only for a server that predates the code.
        planLimit: serverRefusalCode(error) === 'tier_limit' || isPlanLimitMessage(refusal),
      };
    return { success: false, reason: 'error', message: (error as Error)?.message };
  }
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
