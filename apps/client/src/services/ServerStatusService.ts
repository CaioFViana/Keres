import type { ServerSelect } from '../db/schema';
import apiClient, { apiUrl } from './apiClient';

export type ServerPingStatus = 'idle' | 'pending' | 'online' | 'offline';

/** A registered server together with what the last look at it found. */
export interface ServerWithStatus extends ServerSelect {
  pingStatus: ServerPingStatus;
  /** The API version the server answered with; `null` while unknown or unreachable. */
  apiVersion: string | null;
}

/** How long a server has to answer before it counts as unreachable. */
const PING_TIMEOUT_MS = 5000;

/**
 * Asks the server whether it is there: `/kerescheck` answering 200 with its version. Never rejects -
 * a server that does not answer is simply offline.
 */
export async function pingServer(server: ServerSelect): Promise<ServerWithStatus> {
  try {
    const response = await apiClient.get(apiUrl(server.url, '/kerescheck'), {
      timeout: PING_TIMEOUT_MS,
      validateStatus: () => true, // Always resolve, don't reject on HTTP status codes
    });
    if (response.status === 200 && response.data && typeof response.data.version === 'string') {
      return { ...server, pingStatus: 'online', apiVersion: response.data.version };
    }
    return { ...server, pingStatus: 'offline', apiVersion: null };
  } catch {
    return { ...server, pingStatus: 'offline', apiVersion: null };
  }
}
