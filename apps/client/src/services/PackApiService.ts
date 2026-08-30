import { PackContentSchema, type PackContentType, type PackVisibility } from '@keres/shared';
import type { ServerSelect } from '../db/schemas/servers';
import { createKeresAxiosInstance } from './apiClient';
import { authTokenManager } from './AuthTokenManager';

/**
 * The pack routes, spoken to a specific server.
 *
 * A client of its own rather than the shared `apiClient`, for the same reason as
 * `PublicationApiService`: that one points at a single server at a time (the last one
 * synchronization or the open story set), while packs are browsed across every registered server.
 *
 * Nothing here touches the synchronization engine. A pack has no operation log, no version
 * negotiation and no conflict resolution: it is one row, fetched or sent whole. Sharing a new
 * version is re-uploading the same id, which the server takes as a replacement by its author.
 */

export interface RemotePack {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  language: string | null;
  authorName: string | null;
  version: number;
  visibility: PackVisibility;
  createdAt: string;
  updatedAt: string;
}

export interface RemotePackWithContent extends RemotePack {
  content: PackContentType;
}

export interface UploadPackPayload {
  id: string;
  name: string;
  description: string | null;
  language: string | null;
  authorName: string | null;
  version: number;
  /** Private unless the author asked for the Showcase. See `PackVisibilitySchema`. */
  visibility: PackVisibility;
  content: PackContentType;
}

export class PackApiService {
  private clientFor(server: ServerSelect) {
    const client = createKeresAxiosInstance({ baseURL: server.url });
    client.setTokenProvider(authTokenManager);
    client.setActiveServer(server);
    return client;
  }

  /** Metadata only: the server builds this from columns and never opens a payload. */
  async list(server: ServerSelect): Promise<RemotePack[]> {
    const response = await this.clientFor(server).get('/packs/');
    return response.data;
  }

  /**
   * Downloads one pack whole.
   *
   * The payload is validated here rather than trusted: it arrives as opaque JSON the server never
   * inspected beyond accepting it, and a pack written by a newer client could carry a shape this one
   * cannot apply. Failing at the download is a message; failing at story creation is a broken story.
   */
  async download(server: ServerSelect, packId: string): Promise<RemotePackWithContent> {
    const response = await this.clientFor(server).get(`/packs/${packId}`);
    return { ...response.data, content: PackContentSchema.parse(response.data.content) };
  }

  async upload(server: ServerSelect, payload: UploadPackPayload): Promise<RemotePack> {
    const response = await this.clientFor(server).post('/packs/', payload);
    return response.data;
  }

  async withdraw(server: ServerSelect, packId: string): Promise<void> {
    await this.clientFor(server).delete(`/packs/${packId}`);
  }
}

export const packApiService = new PackApiService();
