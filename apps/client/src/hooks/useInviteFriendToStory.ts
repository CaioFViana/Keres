import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../db';
import type { ServerSelect } from '../db/schemas/servers';
import { storyInvitationApi } from '../services/StoryInvitationApiService';
import { createStoryInvitationService } from '../services/StoryInvitationService';
import { useNotificationStore } from '../state/notificationStore';
import { AppAlert } from '../utils/AppAlert';

export type InviteRole = 'reader' | 'writer';
export type InvitableStory = { id: string; title: string };

interface UseInviteFriendToStoryOptions {
  /** The dialog is open: the stories are read each time it opens, so they are never stale. */
  open: boolean;
  /** Null until the friendship is read: there is nothing to offer yet. */
  server: ServerSelect | null;
  friendId: string | null;
  /** Stories that need no invitation: the friend already works on them, or was already invited. */
  excludeStoryIds: readonly string[];
  /** Runs after an invitation went out. */
  onInvited: () => void;
}

/**
 * Inviting one friend to one of the person's stories. The stories offered are the ones the person owns
 * on the friend's server (a story reaches a server from its own settings); the invitation is sent, the
 * app's invitation list is refreshed so it shows at once, and the person is told.
 */
export function useInviteFriendToStory({
  open,
  server,
  friendId,
  excludeStoryIds,
  onInvited,
}: UseInviteFriendToStoryOptions) {
  const { t } = useTranslation();
  const db = useDrizzle();
  const { showNotification } = useNotificationStore();
  const [stories, setStories] = useState<InvitableStory[] | null>(null);
  const [busy, setBusy] = useState(false);
  const serverId = server?.id ?? null;

  useEffect(() => {
    if (!open || !serverId) return undefined;
    let cancelled = false;
    void (async () => {
      const rows = await db.query.stories.findMany({
        where: (story, { and, eq }) =>
          and(eq(story.serverId, serverId), eq(story.isDeleted, false), eq(story.myRole, 'owner')),
        columns: { id: true, title: true },
      });
      if (cancelled) return;
      const hidden = new Set(excludeStoryIds);
      setStories(
        rows.filter((row) => !hidden.has(row.id)).sort((a, b) => a.title.localeCompare(b.title)),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [open, db, serverId, excludeStoryIds]);

  /** Resolves to whether the invitation went out. */
  const invite = useCallback(
    async (storyId: string, role: InviteRole): Promise<boolean> => {
      if (!server || !friendId) return false;
      setBusy(true);
      try {
        const invitation = await storyInvitationApi.invite(server, storyId, friendId, role);
        await createStoryInvitationService(db).syncWithServer(server);
        showNotification(
          t('story_invitation_sent', { name: invitation.inviteeUsername }),
          'success',
        );
        onInvited();
        return true;
      } catch (error) {
        console.error('Failed to invite a friend to a story:', error);
        // The server refuses whoever is not age-verified on an adults-only story, with the friendship intact.
        const status = (error as { response?: { status?: number } })?.response?.status;
        AppAlert.alert(
          t('error'),
          t(status === 403 ? 'invite_nsfw_blocked' : 'invite_collaborator_failed'),
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [db, friendId, onInvited, server, showNotification, t],
  );

  return { stories, busy, invite };
}
