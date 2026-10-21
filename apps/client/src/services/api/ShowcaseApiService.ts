import type { ShowcaseStoryResponse } from '@keres/shared';
import type { ServerSelect } from '@/src/db/schemas/servers';
import { authTokenManager } from '@/src/services/auth/AuthTokenManager';
import { isAllowedServerUrl } from '@/src/utils/auth/serverUrl';
import {
  createKeresAxiosInstance,
  createPlainAxiosInstance,
  getServerAccessToken,
} from './apiClient';

/**
 * Whose public site is being read: a server the person registered (their session, if they have one, rides
 * along - it is what shows the adults-only shelf to a verified adult), or one they only have a link to, which
 * is read the way any visitor would, with nothing of theirs sent.
 */
export type ShowcaseSource =
  | { kind: 'server'; server: ServerSelect }
  | { kind: 'guest'; origin: string };

export function showcaseSourceUrl(source: ShowcaseSource): string {
  return source.kind === 'server' ? source.server.url : source.origin;
}

/** What a server says about its public site; `showcaseEnabled` is false when the site is switched off. */
export interface ShowcaseServerConfig {
  showcaseEnabled: boolean;
  siteName?: string;
  serverVersion?: string;
}

export type ShowcaseUnlockFailure = 'wrong' | 'locked' | 'failed';

/** Why a story could not be unlocked: the password was not it, too many tries were made, or the server failed. */
export class ShowcaseUnlockError extends Error {
  readonly reason: ShowcaseUnlockFailure;

  constructor(reason: ShowcaseUnlockFailure) {
    super(`Could not unlock the story: ${reason}.`);
    this.name = 'ShowcaseUnlockError';
    this.reason = reason;
  }
}

/** A package can be tens of megabytes: the default HTTP patience is for small answers. */
export const SHOWCASE_DOWNLOAD_TIMEOUT_MS = 300_000;

interface DownloadOptions {
  /** Called with 0–1 while the bytes arrive; never when the server does not say how many there are. */
  onProgress?: (fraction: number) => void;
}

/**
 * The server's public site, read from the app. Every route here asks for no sign-in: what it answers is what a
 * visitor of the website is shown.
 *
 * A story behind a password is opened with the token its unlock returns, sent as `Authorization: Showcase …`
 * - joined to the session as the website does it, because the two credentials are read independently.
 */
export class ShowcaseApiService {
  private clientFor(source: ShowcaseSource) {
    const client = createKeresAxiosInstance({ baseURL: showcaseSourceUrl(source) });
    if (source.kind === 'server') {
      client.setTokenProvider(authTokenManager);
      client.setActiveServer(source.server);
    }
    return client;
  }

  /** The header that carries the session (when this is a registered server and there is one) and the unlock. */
  private authorization(source: ShowcaseSource, unlockToken?: string | null): string | undefined {
    const session = source.kind === 'server' ? getServerAccessToken(source.server.id) : null;
    const parts = [
      session ? `Bearer ${session}` : null,
      unlockToken ? `Showcase ${unlockToken}` : null,
    ];
    const joined = parts.filter(Boolean).join(', ');
    return joined || undefined;
  }

  private headersFor(source: ShowcaseSource, unlockToken?: string | null) {
    const authorization = this.authorization(source, unlockToken);
    return authorization && unlockToken ? { Authorization: authorization } : undefined;
  }

  /** The server's public config, `null` when it cannot say: unreachable, or not a Keres server at all. */
  async getConfig(source: ShowcaseSource): Promise<ShowcaseServerConfig | null> {
    try {
      const response =
        await this.clientFor(source).get<Partial<ShowcaseServerConfig>>('/public/config');
      const data = response.data;
      if (!data || typeof data.showcaseEnabled !== 'boolean') return null;
      return {
        showcaseEnabled: data.showcaseEnabled,
        siteName: data.siteName,
        serverVersion: data.serverVersion,
      };
    } catch {
      return null;
    }
  }

  /**
   * A story's page: its detail, or - when it is behind a password and none was given - the stub that says so.
   * A story that is not there, or not for this viewer, is a 404 the caller reads with `isNotFoundError`.
   */
  async getStory(
    source: ShowcaseSource,
    storyId: string,
    unlockToken?: string | null,
  ): Promise<ShowcaseStoryResponse> {
    const response = await this.clientFor(source).get<ShowcaseStoryResponse>(
      `/public/stories/${encodeURIComponent(storyId)}`,
      { headers: this.headersFor(source, unlockToken) },
    );
    return response.data;
  }

  /** Trades the password for the token that opens the story for an hour. */
  async unlockStory(source: ShowcaseSource, storyId: string, password: string): Promise<string> {
    try {
      const response = await this.clientFor(source).post<{ token: string }>(
        `/public/stories/${encodeURIComponent(storyId)}/unlock`,
        { password },
      );
      return response.data.token;
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      throw new ShowcaseUnlockError(
        status === 401 ? 'wrong' : status === 429 ? 'locked' : 'failed',
      );
    }
  }

  /**
   * The address of a version's online reader, absolute. For a story behind a password (or an adults-only one)
   * it carries a token that lasts a minute, so it is asked for when the reader is about to be opened.
   */
  async getReaderUrl(
    source: ShowcaseSource,
    storyId: string,
    publicationId: string,
    unlockToken?: string | null,
  ): Promise<string> {
    return this.signedUrl(source, storyId, publicationId, 'reader/url', unlockToken);
  }

  /** A version's Keres package (`.zip`): the same bytes as an export, ready for the importer. */
  async downloadPackage(
    source: ShowcaseSource,
    storyId: string,
    publicationId: string,
    unlockToken?: string | null,
    options: DownloadOptions = {},
  ): Promise<Uint8Array> {
    const url = await this.signedUrl(source, storyId, publicationId, 'download-url', unlockToken);
    return this.fetchBytes(url, options);
  }

  private async signedUrl(
    source: ShowcaseSource,
    storyId: string,
    publicationId: string,
    endpoint: string,
    unlockToken?: string | null,
  ): Promise<string> {
    const response = await this.clientFor(source).post<{ url: string }>(
      `/public/stories/${encodeURIComponent(storyId)}/publications/${encodeURIComponent(publicationId)}/${endpoint}`,
      undefined,
      { headers: this.headersFor(source, unlockToken) },
    );
    return new URL(response.data.url, showcaseSourceUrl(source)).href;
  }

  /**
   * The bytes behind a signed address. Fetched with a plain client on purpose: the address carries its own
   * permission, and a storage host the server redirects to must not be handed the session.
   */
  private async fetchBytes(url: string, { onProgress }: DownloadOptions): Promise<Uint8Array> {
    if (!isAllowedServerUrl(url)) {
      throw new Error('Plain http is only allowed on the local network');
    }
    const response = await createPlainAxiosInstance().get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: SHOWCASE_DOWNLOAD_TIMEOUT_MS,
      onDownloadProgress: (event) => {
        if (onProgress && event.total) onProgress(event.loaded / event.total);
      },
    });
    return new Uint8Array(response.data);
  }
}

export const showcaseApiService = new ShowcaseApiService();
