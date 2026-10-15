import type { Story } from '@keres/shared/entities/Story';
import type { AppDrizzleClient } from '@/src/db';
import type { ServerSelect } from '@/src/db/schema';
import { useStoryListStore } from '@/src/state/story/storyListStore';
import { useStoryStore } from '@/src/state/story/storyStore';
import { useUserSettingsStore } from '@/src/state/app/userSettingsStore';
import { authTokenManager } from '@/src/services/auth/AuthTokenManager';
import { createServerService } from '@/src/services/servers/ServerService';
import {
  createStoryService,
  type StoryService,
} from '@/src/services/storymanagement/story-lifecycle/StoryService';
import { userApiService } from '@/src/services/api/UserApiService';

/**
 * The account was deleted on the server, but this device could not finish removing the server.
 * The tokens are already gone by the time this is thrown; "Remove this server" finishes the job.
 */
export class AccountDeletionCleanupError extends Error {
  constructor(public readonly reason: unknown) {
    super('The account was deleted, but the server could not be removed from this device.');
    this.name = 'AccountDeletionCleanupError';
  }
}

/** Puts the story's current local row into the list and the open-story slot, so no screen keeps its old link. */
async function refreshStoryInStores(
  storyService: StoryService,
  storyId: string,
  currentUserId: string,
): Promise<void> {
  const story = await storyService.getStoryById(storyId, currentUserId);
  if (!story) return;
  useStoryListStore.getState().updateStory(story as Story);
  if (useStoryStore.getState().selectedStory?.id === storyId) {
    useStoryStore.getState().setSelectedStory(story as Story);
  }
}

/**
 * Deletes the account on `server` and leaves this device with the stories the person owned there as
 * ordinary local stories, with the server entry removed - so the address can be registered again.
 *
 * Order matters:
 * - Nothing local changes until the server has confirmed the deletion. A wrong password, or no network,
 *   throws from the API call and the device is left exactly as it was.
 * - Only then is each owned story detached LOCALLY. No server call is made for it: the account's session
 *   may be gone by now, and a server-side story delete would also take the story from its collaborators.
 *   The server's copy is left to the server's own rules for a deleted account.
 * - If a local step fails after the server confirmed, the tokens are still cleared (no logged-in look
 *   over a dead account) and `AccountDeletionCleanupError` tells the caller to finish with the removal.
 */
export async function deleteServerAccount(
  db: AppDrizzleClient,
  server: ServerSelect,
  currentPassword: string,
  currentUserId: string,
): Promise<void> {
  const serverService = createServerService(db);
  const storyService = createStoryService(db);

  const ownedStories = await serverService.getOwnedStories(server.id);

  await userApiService.deleteOwnAccount(server, currentPassword);

  try {
    for (const story of ownedStories) {
      await storyService.detachFromServerLocally(currentUserId, story.id);
      await refreshStoryInStores(storyService, story.id, currentUserId);
    }
    // Purges the reader and writer copies, publications, friendships and payments of this server,
    // marks the entry deleted and clears its tokens.
    await serverService.deleteServer(server.id);
  } catch (error) {
    try {
      await authTokenManager.clearAuthForServer(server.id);
    } catch (clearError) {
      console.error('Failed to clear the tokens of a deleted account:', clearError);
    }
    throw new AccountDeletionCleanupError(error);
  }

  // Clearing the tokens already drops the active server when it is this one; doing it here too keeps
  // the guarantee on this flow's own path rather than on that side effect.
  if (useUserSettingsStore.getState().activeServer?.id === server.id) {
    useUserSettingsStore.getState().clearActiveServer();
  }
}
