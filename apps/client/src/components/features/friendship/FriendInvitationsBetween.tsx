import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import type { ServerStoryInvitation } from '../../../services/StoryInvitationService';
import { useTheme } from '../../../theme';

interface FriendInvitationsBetweenProps {
  /** Invitations this friend sent the person: to accept or decline. */
  received: ServerStoryInvitation[];
  /** Invitations the person sent this friend: to withdraw. */
  sent: ServerStoryInvitation[];
  busyId: string | null;
  onAccept: (invitation: ServerStoryInvitation) => void;
  onDecline: (invitation: ServerStoryInvitation) => void;
  onWithdraw: (invitation: ServerStoryInvitation) => void;
}

/**
 * The invitations still open between the person and this friend, in both directions, each with the
 * answer it needs. Renders nothing while there are none.
 */
const FriendInvitationsBetween: React.FC<FriendInvitationsBetweenProps> = ({
  received,
  sent,
  busyId,
  onAccept,
  onDecline,
  onWithdraw,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  if (received.length === 0 && sent.length === 0) return null;

  const role = (invitation: ServerStoryInvitation) =>
    t(invitation.permissionType === 'writer' ? 'permission_writer' : 'permission_reader');

  const row = (invitation: ServerStoryInvitation, isReceived: boolean) => (
    <View
      key={invitation.id}
      testID={`friend-invitation-${invitation.id}`}
      style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surface }]}
    >
      <Ionicons name="mail-open-outline" size={24} color={colors.primary} />
      <View style={styles.texts}>
        <Text style={[styles.storyTitle, { color: colors.text }]} numberOfLines={2}>
          {invitation.storyTitle}
        </Text>
        <Text style={[styles.detail, { color: colors.textSecondary }]}>
          {t(isReceived ? 'friend_invitation_received' : 'friend_invitation_sent', {
            role: role(invitation),
          })}
        </Text>
        <View style={styles.actions}>
          {isReceived ? (
            <>
              <Button
                onPress={() => onAccept(invitation)}
                disabled={busyId !== null}
                style={styles.action}
                testID={`friend-invitation-accept-${invitation.id}`}
              >
                {t('friend_accept')}
              </Button>
              <Button
                variant="secondary"
                onPress={() => onDecline(invitation)}
                disabled={busyId !== null}
                style={styles.action}
                testID={`friend-invitation-decline-${invitation.id}`}
              >
                {t('friend_decline')}
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              onPress={() => onWithdraw(invitation)}
              disabled={busyId !== null}
              style={styles.action}
              testID={`friend-invitation-withdraw-${invitation.id}`}
            >
              {t('friend_cancel_request')}
            </Button>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <View testID="friend-invitations">
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {t('friend_invitations_title')}
      </Text>
      {received.map((invitation) => row(invitation, true))}
      {sent.map((invitation) => row(invitation, false))}
    </View>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  texts: { flex: 1, minWidth: 0 },
  storyTitle: { fontSize: 16, fontWeight: '600' },
  detail: { fontSize: 13, marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  action: { paddingVertical: 8, paddingHorizontal: 14, minWidth: 100 },
});

export default FriendInvitationsBetween;
