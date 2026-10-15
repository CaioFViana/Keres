import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '@/src/db';
import type { ServerSelect } from '@/src/db/schema';
import {
  acceptStoryInvitation,
  closeStoryInvitation,
} from '@/src/services/social/storyInvitationActions';
import { useNotificationStore } from '@/src/state/ui/notificationStore';
import type { ServerStoryInvitation } from '@/src/services/social/StoryInvitationService';
import { AppAlert } from '@/src/state/ui/AppAlert';
import { useStoryInvitations } from './useStoryInvitations';

export type { ServerStoryInvitation };

export type StoryInvitationServerLookup = (serverId: string) => ServerSelect | undefined;

/**
 * The open story invitations of every known server, split into received (accept, decline) and sent
 * (withdraw), each action confirmed first and announced after. Accepting is what grants access - and
 * downloads the story to this device.
 */
export function useStoryInvitationList(serverFor: StoryInvitationServerLookup) {
  const { t } = useTranslation();
  const db = useDrizzle();
  const { showNotification } = useNotificationStore();
  const allInvitations = useStoryInvitations();
  const [busyId, setBusyId] = useState<string | null>(null);

  const invitations = allInvitations.filter((invitation) => serverFor(invitation.serverId));

  const confirmThenRun = (
    invitation: ServerStoryInvitation,
    [title, message]: [string, string],
    action: (server: ServerSelect) => Promise<void>,
    successKey: string,
    /** What a 429 says for this action, when the action can be refused by a plan limit. */
    limitKey?: string,
  ) =>
    AppAlert.alert(
      title,
      message,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('proceed'),
          onPress: async () => {
            const server = serverFor(invitation.serverId);
            if (!server) return;
            setBusyId(invitation.id);
            try {
              await action(server);
              showNotification(t(successKey, { story: invitation.storyTitle }), 'success');
            } catch (error) {
              console.log('useStoryInvitationList: invitation action failed.', error);
              const status = (error as { response?: { status?: number } })?.response?.status;
              // The invitation stays open on a 429, so the owner can raise the limit and it can be accepted later.
              const key = status === 429 && limitKey ? limitKey : 'story_invitation_failed';
              showNotification(t(key), 'error');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
      { cancelable: true },
    );

  return {
    received: invitations.filter((invitation) => invitation.inviteeId === invitation.serverUserId),
    sent: invitations.filter((invitation) => invitation.inviterId === invitation.serverUserId),
    busyId,
    accept: (invitation: ServerStoryInvitation) =>
      confirmThenRun(
        invitation,
        [t('story_invitation_accept'), t('story_invitation_accept_message')],
        (server) => acceptStoryInvitation(db, server, invitation),
        'story_invitation_accepted',
        'accept_invitation_limit_reached',
      ),
    decline: (invitation: ServerStoryInvitation) =>
      confirmThenRun(
        invitation,
        [t('story_invitation_decline'), t('story_invitation_decline_message')],
        (server) => closeStoryInvitation(db, server, invitation),
        'story_invitation_declined',
      ),
    withdraw: (invitation: ServerStoryInvitation) =>
      confirmThenRun(
        invitation,
        [t('story_invitation_withdraw'), t('story_invitation_withdraw_message')],
        (server) => closeStoryInvitation(db, server, invitation),
        'story_invitation_withdrawn',
      ),
  };
}
