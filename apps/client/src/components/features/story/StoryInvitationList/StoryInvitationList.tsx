import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  type ServerStoryInvitation,
  type StoryInvitationServerLookup,
  useStoryInvitationList,
} from '../../../../hooks/useStoryInvitationList';
import { useTheme } from '../../../../theme';
import { getCommonCardStyles } from '../../../../theme/commonStyles';

interface StoryInvitationListProps {
  /** Resolves an invitation's server; invitations of an unknown server are not shown. */
  serverFor: StoryInvitationServerLookup;
}

/**
 * The story invitations part of the friendship screen: invitations received (accept or decline) and
 * sent (withdraw). Renders nothing while there are none.
 */
export default function StoryInvitationList({ serverFor }: StoryInvitationListProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { received, sent, busyId, accept, decline, withdraw } = useStoryInvitationList(serverFor);
  const cardStyles = getCommonCardStyles(colors);
  if (received.length === 0 && sent.length === 0) return null;

  const roleLabel = (invitation: ServerStoryInvitation) =>
    t(invitation.permissionType === 'writer' ? 'permission_writer' : 'permission_reader');

  const actionButton = (
    testID: string,
    label: string,
    icon: keyof typeof Ionicons.glyphMap,
    color: string,
    onPress: () => void,
  ) => (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busyId !== null}
      style={styles.actionButton}
      onPress={onPress}
    >
      <Ionicons name={icon} size={24} color={color} />
    </TouchableOpacity>
  );

  const renderRow = (invitation: ServerStoryInvitation, isReceived: boolean) => (
    <View
      key={invitation.id}
      style={[cardStyles.cardContainer, styles.row]}
      testID={`story-invitation-${invitation.id}`}
    >
      <Ionicons name="book-outline" size={28} color={colors.primary} />
      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {invitation.storyTitle}
        </Text>
        <Text style={[styles.detail, { color: colors.textSecondary }]}>
          {t(isReceived ? 'story_invitation_from' : 'story_invitation_to', {
            name: isReceived ? invitation.inviterUsername : invitation.inviteeUsername,
            role: roleLabel(invitation),
          })}
        </Text>
      </View>
      <View style={styles.actions}>
        {isReceived ? (
          <>
            {actionButton(
              `story-invitation-accept-${invitation.id}`,
              t('story_invitation_accept'),
              'checkmark-circle-outline',
              colors.primary,
              () => accept(invitation),
            )}
            {actionButton(
              `story-invitation-decline-${invitation.id}`,
              t('story_invitation_decline'),
              'close-circle-outline',
              colors.error,
              () => decline(invitation),
            )}
          </>
        ) : (
          actionButton(
            `story-invitation-withdraw-${invitation.id}`,
            t('story_invitation_withdraw'),
            'close-circle-outline',
            colors.secondary,
            () => withdraw(invitation),
          )
        )}
      </View>
    </View>
  );

  const header = (title: string) => (
    <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{title}</Text>
  );

  return (
    <View testID="story-invitation-list">
      {received.length > 0 && header(t('story_invitations_received'))}
      {received.map((invitation) => renderRow(invitation, true))}
      {sent.length > 0 && header(t('story_invitations_sent'))}
      {sent.map((invitation) => renderRow(invitation, false))}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 5,
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, padding: 15 },
  info: { flex: 1, marginLeft: 12 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  detail: { fontSize: 14 },
  actions: { flexDirection: 'row', marginLeft: 10 },
  actionButton: { padding: 8, marginLeft: 5 },
});
