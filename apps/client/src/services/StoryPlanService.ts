import type { StoryPlan } from '@keres/shared';
import type { AppDrizzleClient } from '../db';
import { createKeresAxiosInstance, isOfflineError } from './apiClient';
import { authTokenManager } from './AuthTokenManager';
import { createServerService } from './ServerService';

/**
 * The entity ceilings of the plan a story counts against, from the server the story is linked to.
 * Never stored: the server is what knows the plan, and it can change between two looks.
 *
 * `null` for everything that only means "nothing to show": the story is not on a server, the server
 * is no longer registered, the device is offline, or the server is older than this route. The
 * entity count is information first, and the plan is a bonus on top of it.
 */
export const createStoryPlanService = (db: AppDrizzleClient) => ({
  async getPlan(serverId: string | null | undefined, storyId: string): Promise<StoryPlan | null> {
    if (!serverId) return null;
    const server = await createServerService(db).getServerById(serverId);
    if (!server) return null;
    try {
      const client = createKeresAxiosInstance({ baseURL: server.url });
      client.setTokenProvider(authTokenManager);
      client.setActiveServer(server);
      const response = await client.get<StoryPlan>(`/stories/${storyId}/plan`);
      return response.data;
    } catch (error) {
      if (!isOfflineError(error)) {
        console.warn('StoryPlanService: could not read the plan of the story.', error);
      }
      return null;
    }
  },
});
