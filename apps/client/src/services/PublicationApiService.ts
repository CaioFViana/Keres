import type { PublicationLabelMode, ShowcaseVisibility, StoryPublication } from '@keres/shared';
import type { ServerSelect } from '../db/schemas/servers';
import { createKeresAxiosInstance } from './apiClient';
import { authTokenManager } from './AuthTokenManager';

export interface StoryShowcaseState {
  isPublished: boolean;
  visibility: ShowcaseVisibility;
  labelMode: PublicationLabelMode;
  hasPassword: boolean;
  publications: StoryPublication[];
}

/**
 * The publication routes, spoken to a specific server.
 *
 * The same reason as `FriendshipApiService` for not using the shared `apiClient`: that one points at a
 * single server at a time (the last one synchronization or the open story set), and the publication
 * screen lists stories from every registered server.
 */
export class PublicationApiService {
  private clientFor(server: ServerSelect) {
    const client = createKeresAxiosInstance({ baseURL: server.url });
    client.setTokenProvider(authTokenManager);
    client.setActiveServer(server);
    return client;
  }

  /** Every story publication this account can read on this server - its own or shared with it. */
  async listVisible(server: ServerSelect): Promise<StoryPublication[]> {
    const response = await this.clientFor(server).get('/stories/publications/mine');
    return response.data;
  }

  async getStoryShowcase(server: ServerSelect, storyId: string): Promise<StoryShowcaseState> {
    const response = await this.clientFor(server).get(`/stories/${storyId}/publications`);
    return response.data;
  }

  /**
   * `visibility` travels with the publication on purpose: it describes how *this* publication should be
   * exposed, and the server rewrites it on every publication. A separate call only when there is a
   * password would make the "publish without a password" path change nothing, leaving an earlier
   * protection in force with nobody having asked for it.
   */
  async publish(
    server: ServerSelect,
    storyId: string,
    operationVersion: number,
    labelMode: PublicationLabelMode,
    visibility: ShowcaseVisibility = 'public',
    password?: string,
  ): Promise<StoryPublication> {
    const response = await this.clientFor(server).post(`/stories/${storyId}/publications`, {
      operationVersion,
      labelMode,
      visibility,
      password,
    });
    return response.data;
  }

  async setVisibility(
    server: ServerSelect,
    storyId: string,
    visibility: ShowcaseVisibility,
    password?: string,
  ): Promise<void> {
    await this.clientFor(server).put(`/stories/${storyId}/showcase`, { visibility, password });
  }

  async deletePublication(
    server: ServerSelect,
    storyId: string,
    publicationId: string,
  ): Promise<void> {
    await this.clientFor(server).delete(`/stories/${storyId}/publications/${publicationId}`);
  }

  async unpublish(server: ServerSelect, storyId: string): Promise<void> {
    await this.clientFor(server).delete(`/stories/${storyId}/publications`);
  }
}

export const publicationApiService = new PublicationApiService();
