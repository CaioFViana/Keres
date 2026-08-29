import { and, eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../db';
import type { ServerInsert, ServerSelect } from '../db/schema';
import { friendships, servers, stories, storyPublications } from '../db/schema';
import { useConnectivityStore } from '../state/connectivityStore';
import { useNotificationStore } from '../state/notificationStore';
import { useStoryListStore } from '../state/storyListStore';
import { useStoryStore } from '../state/storyStore';
import type { Create } from '../utils/entityUtils';
import { prepareNewEntityData } from '../utils/entityUtils';
import { entityEventEmitter } from '../utils/EventEmitter';
import { isJwtExpired } from '../utils/jwtUtils'; // Added
import { normalizeServerUrl } from '../utils/serverUrl';
import { isOfflineError } from './apiClient';
import { authTokenManager } from './AuthTokenManager';
import { mediaFileService } from './MediaFileService';
import { deleteStoryChildRows } from './storymanagement/storyLocalPurge';

export interface OwnedServerStory {
  id: string;
  title: string;
}

export class ServerHasOwnedStoriesError extends Error {
  constructor(public readonly ownedStories: OwnedServerStory[]) {
    super('Cannot remove a server while locally linked stories are owned by this account.');
    this.name = 'ServerHasOwnedStoriesError';
  }
}

export class ServerUrlAlreadyRegisteredError extends Error {
  constructor(public readonly existingServer: ServerSelect) {
    super('A server with this URL is already registered.');
    this.name = 'ServerUrlAlreadyRegisteredError';
  }
}

export interface ServerService {
  getAllServers(): Promise<ServerSelect[]>;
  getServerById(serverId: string): Promise<ServerSelect | undefined>;
  getServerByUrl(url: string): Promise<ServerSelect | undefined>;
  createServer(serverData: Create<ServerInsert>): Promise<ServerSelect>;
  updateServer(
    serverId: string,
    serverData: Partial<
      Omit<ServerInsert, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>
    >,
  ): Promise<void>;
  getOwnedStories(serverId: string): Promise<OwnedServerStory[]>;
  deleteServer(serverId: string): Promise<void>;
  refreshServerToken(server: ServerSelect): Promise<ServerSelect>; // Added
}

export const createServerService = (db: AppDrizzleClient): ServerService => {
  const { showNotification } = useNotificationStore.getState();

  return {
    async getAllServers(): Promise<ServerSelect[]> {
      const fetchedServers = await db.query.servers.findMany({
        // Added await here
        where: eq(servers.isDeleted, false),
      });
      return fetchedServers;
    },

    async getServerById(serverId: string): Promise<ServerSelect | undefined> {
      return db.query.servers.findFirst({
        where: and(eq(servers.id, serverId), eq(servers.isDeleted, false)),
      });
    },

    async getServerByUrl(url: string): Promise<ServerSelect | undefined> {
      const canonical = normalizeServerUrl(url);
      const live = await this.getAllServers();
      return live.find((server) => normalizeServerUrl(server.url) === canonical);
    },

    async createServer(serverData): Promise<ServerSelect> {
      const url = normalizeServerUrl(serverData.url);
      const existing = await this.getServerByUrl(url);
      if (existing) {
        throw new ServerUrlAlreadyRegisteredError(existing);
      }
      const newServer = prepareNewEntityData<ServerInsert>({ ...serverData, url });
      const result = await db.insert(servers).values(newServer).returning().get();
      return result;
    },

    async updateServer(serverId: string, serverData): Promise<void> {
      const nextData =
        serverData.url === undefined
          ? serverData
          : { ...serverData, url: normalizeServerUrl(serverData.url) };
      if (nextData.url !== undefined) {
        const current = await this.getServerById(serverId);
        const urlChanged = !current || normalizeServerUrl(current.url) !== nextData.url;
        if (urlChanged) {
          const existing = await this.getServerByUrl(nextData.url);
          if (existing && existing.id !== serverId) {
            throw new ServerUrlAlreadyRegisteredError(existing);
          }
        }
      }
      await db
        .update(servers)
        .set({ ...nextData, updatedAt: new Date() })
        .where(eq(servers.id, serverId))
        .run();
    },

    async getOwnedStories(serverId: string): Promise<OwnedServerStory[]> {
      return db
        .select({ id: stories.id, title: stories.title })
        .from(stories)
        .where(
          and(
            eq(stories.serverId, serverId),
            eq(stories.myRole, 'owner'),
            eq(stories.isDeleted, false),
          ),
        )
        .all();
    },

    async deleteServer(serverId: string): Promise<void> {
      const linkedStories = await db
        .select({ id: stories.id, title: stories.title, myRole: stories.myRole, isDeleted: stories.isDeleted })
        .from(stories)
        .where(eq(stories.serverId, serverId))
        .all();
      const ownedStories = linkedStories.filter(
        (story) => story.myRole === 'owner' && !story.isDeleted,
      );
      if (ownedStories.length > 0) {
        throw new ServerHasOwnedStoriesError(ownedStories);
      }
      // A server-owned story that is already deleted is only a stale local tombstone. Every other
      // non-owner row is a reader/writer cache. Neither may remain once its server registration,
      // credentials and sync route are gone.
      const storyIdsToPurge = linkedStories
        .filter((story) => story.myRole !== 'owner' || story.isDeleted)
        .map((story) => story.id);

      await db.transaction(async (tx) => {
        for (const storyId of storyIdsToPurge) {
          await deleteStoryChildRows(tx, storyId);
          await tx.delete(stories).where(eq(stories.id, storyId)).run();
        }
        // Publications are server cache too. They do not go through operation logs and must not
        // make a removed server appear to still own data in a later session.
        await tx.delete(storyPublications).where(eq(storyPublications.serverId, serverId)).run();
        // Friendships are a local cache of server state. Leaving the server must remove
        // only this local copy; logging in again will repopulate it from the unchanged API.
        await tx.delete(friendships).where(eq(friendships.serverId, serverId)).run();
        await tx
          .update(servers)
          .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
          .where(eq(servers.id, serverId))
          .run();
      });

      for (const storyId of storyIdsToPurge) {
        mediaFileService.deleteStoryMedia(storyId);
        useStoryListStore.getState().removeStory(storyId);
      }
      const selectedStory = useStoryStore.getState().selectedStory;
      if (selectedStory && storyIdsToPurge.includes(selectedStory.id)) {
        useStoryStore.getState().setSelectedStory(null);
      }
      await authTokenManager.clearAuthForServer(serverId);
      entityEventEmitter.emit('friendship_changed');
      entityEventEmitter.emit('server_connection_changed');
    },

    async refreshServerToken(server: ServerSelect): Promise<ServerSelect> {
      const tokens = await authTokenManager.getTokens(server.id);
      if (!tokens) {
        // Persistent state (the server was never authenticated), re-evaluated on every
        // sync cycle - log it, but don't notify the user every interval.
        console.log(
          `Server ${server.name} does not have JWT or Refresh Token. Please re-authenticate.`,
        );
        return server;
      }

      // Check if the JWT is actually expired before trying to refresh
      if (!isJwtExpired(tokens.accessToken)) {
        console.log(`JWT for server ${server.name} is not expired. No refresh needed.`);
        return server; // Return current server if not expired
      }

      console.log(`Attempting to refresh token for server ${server.name}...`);
      try {
        // Trigger the token refresh via the AuthTokenManager
        // This will update the tokens in the database and the user settings store
        const refreshedTokens = await authTokenManager.refreshAccessToken(
          server.id,
          tokens.refreshToken,
        );

        if (!refreshedTokens) {
          // `refreshAccessToken` itself swallows an offline failure into this same `null`
          // return (it can't tell "unreachable" from "credentials rejected" apart from in
          // here) - the request's own interceptor already reported the server unreachable
          // to `connectivityStore` before returning, so that's the signal to tell them apart.
          if (useConnectivityStore.getState().isOffline(server.id)) {
            console.log(`Server ${server.name} is unreachable; deferring token refresh.`);
            return server;
          }
          const message = `Token refresh failed for server ${server.name}. Please re-authenticate.`;
          console.log(message);
          showNotification(message, 'error');
          return server; // Return original server if refresh failed
        }

        console.log(`Successfully refreshed tokens for server ${server.name}.`);
        showNotification(`Tokens for ${server.name} refreshed successfully.`, 'success');
        return server;
      } catch (error) {
        if (isOfflineError(error)) {
          // Can't refresh while the server is unreachable - not a credentials problem.
          console.log(`Server ${server.name} is unreachable, token refresh deferred.`);
          return server;
        }
        const message = `Failed to refresh token for server ${server.name}. Please re-authenticate.`;
        console.log(message, (error as Error)?.message || error);
        showNotification(message, 'error');
        return server; // Return original server on any refresh error
      }
    },
  };
};
