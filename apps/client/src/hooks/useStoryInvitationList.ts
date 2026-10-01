import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../db';
import type { ServerSelect } from '../db/schema';
import { acceptStoryInvitation, closeStoryInvitation } from '../services/storyInvitationActions';
import { useNotificationStore } from '../state/notificationStore';
import type { ServerStoryInvitation } from '../services/StoryInvitationService';
import { AppAlert } from '../utils/AppAlert';
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
              showNotification(t('story_invitation_failed'), 'error');
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
