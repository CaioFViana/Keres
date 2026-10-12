import type { ReportType } from '@keres/shared';
import type { ServerSelect } from '../db/schemas/servers';
import { createKeresAxiosInstance } from './apiClient';
import { authTokenManager } from './AuthTokenManager';

/**
 * Reporting a story to the administrators: `POST /stories/:storyId/report`.
 * Server-bound like the other story APIs. The type and the free-text reason are sent -
 * the server attaches the story id itself.
 */
function clientFor(server: ServerSelect) {
  const client = createKeresAxiosInstance({ baseURL: server.url });
  client.setTokenProvider(authTokenManager);
  client.setActiveServer(server);
  return client;
}

export const storyReportApi = {
  async report(
    server: ServerSelect,
    storyId: string,
    reason: string,
    type: ReportType = 'other',
  ): Promise<void> {
    await clientFor(server).post(`/stories/${encodeURIComponent(storyId)}/report`, {
      reason,
      type,
    });
  },
};
