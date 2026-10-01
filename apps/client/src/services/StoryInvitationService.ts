import type { StoryInvitation } from '@keres/shared';
import { eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../db';
import { servers, storyInvitations } from '../db/schema';
import type { ServerSelect } from '../db/schema';
import { useNotificationStore } from '../state/notificationStore';
import { entityEventEmitter } from '../utils/EventEmitter';
import i18n from '../utils/i18n';
import { isOfflineError } from './apiClient';
import { storyInvitationApi } from './StoryInvitationApiService';

/** An open invitation, with the server it lives on and this device's user there. */
export type ServerStoryInvitation = StoryInvitation & { serverId: string; serverUserId: string };

export const STORY_INVITATIONS_CHANGED = 'story_invitations_changed';

export const createStoryInvitationService = (db: AppDrizzleClient) =>
  new StoryInvitationService(db);

/**
 * The local copy of every server's open story invitations - a cache of server state like
 * `friendships`: visible offline as last seen, replaced per server on every sync, answered only
 * through the server. Emits `story_invitations_changed` whenever the copy changes.
 */
export class StoryInvitationService {
  constructor(private readonly db: AppDrizzleClient) {}

  /** Every open invitation of the registered servers, newest first. */
  async getAll(): Promise<ServerStoryInvitation[]> {
    const rows = await this.db
      .select({ invitation: storyInvitations, serverUserId: servers.idUser })
      .from(storyInvitations)
      .innerJoin(servers, eq(storyInvitations.serverId, servers.id))
      .where(eq(servers.isDeleted, false))
      .all();
    return rows
      .map(({ invitation, serverUserId }) => ({
        ...invitation,
        createdAt: invitation.createdAt.toISOString(),
        serverUserId,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Replaces the server's invitations with the server's answer and announces the ones received since
   * the last sync. Unreachable servers keep their last copy.
   */
  async syncWithServer(server: ServerSelect): Promise<void> {
    let fetched: StoryInvitation[];
    try {
      fetched = await storyInvitationApi.list(server);
    } catch (error) {
      if (isOfflineError(error)) return;
      throw error;
    }
    const previous = await this.db
      .select({ id: storyInvitations.id })
      .from(storyInvitations)
      .where(eq(storyInvitations.serverId, server.id))
      .all();
    await this.db.transaction(async (tx) => {
      await tx.delete(storyInvitations).where(eq(storyInvitations.serverId, server.id)).run();
      for (const invitation of fetched) {
        await tx
          .insert(storyInvitations)
          .values({ ...invitation, serverId: server.id, createdAt: new Date(invitation.createdAt) })
          .run();
      }
    });

    const known = new Set(previous.map((row) => row.id));
    const { showNotification } = useNotificationStore.getState();
    for (const invitation of fetched) {
      if (known.has(invitation.id) || invitation.inviteeId !== server.idUser) continue;
      showNotification(
        i18n.t('story_invitation_received', {
          name: invitation.inviterUsername,
          story: invitation.storyTitle,
        }),
        'info',
      );
    }
    entityEventEmitter.emit(STORY_INVITATIONS_CHANGED);
  }
}
