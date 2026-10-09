import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ActionMenu from '@/src/components/common/controls/ActionMenu/ActionMenu';
import Button from '@/src/components/common/controls/Button/Button';
import Avatar from '@/src/components/common/display/Avatar/Avatar';
import type { FriendshipWithServer } from '../../../services/FriendshipService';
import { useTheme } from '../../../theme';
import { getCommonCardStyles } from '../../../theme/commonStyles';
import FriendChatButton from '../messages/FriendChatButton';

export interface FriendshipRowActions {
  onOpen: () => void;
  onChat: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
  onUnfriend: () => void;
  onBlock: () => void;
  onUnblock: () => void;
}

interface FriendshipRowProps extends FriendshipRowActions {
  item: FriendshipWithServer;
  /** The user's id on the friendship's server: tells a request received from one sent. */
  currentUsersServerId: string | undefined;
  /** Name the server only when there is more than one to tell apart. */
  showServer: boolean;
}

/**
 * One friendship, by what it is: a request to answer (with the answers spelled out, not as icons), a
 * request waiting on the other side, a friend (chat first, the rest behind a menu) or a block.
 */
const FriendshipRow: React.FC<FriendshipRowProps> = ({
  item,
  currentUsersServerId,
  showServer,
  onOpen,
  onChat,
  onAccept,
  onDecline,
  onCancel,
  onUnfriend,
  onBlock,
  onUnblock,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const cardStyles = getCommonCardStyles(colors);

  const isPending = item.status === FriendStatus.PENDING;
  const isReceived = isPending && item.receiverId === currentUsersServerId;
  const isSent = isPending && item.senderId === currentUsersServerId;
  const isFriend = item.status === FriendStatus.FRIEND;
  const isBlocked = item.status === FriendStatus.BLACKLISTED;
  // Only the side that issued the block can undo it; a row with no recorded blocker predates the
  // column and is offered to both, as the server does.
  const canUnblock =
    isBlocked && (item.blockedById === null || item.blockedById === currentUsersServerId);

  const title = isReceived
    ? t('friend_wants_to_be_friend', { name: item.friendUsername })
    : item.friendUsername;
  const subtitle = [
    item.otherUserTag ? `@${item.otherUserTag}` : null,
    showServer ? item.serverName || item.serverId : null,
    isSent ? t('friend_request_sent_label') : null,
    isBlocked ? t('friend_blocked_label') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const blockMenu = (
    <ActionMenu
      testID={`friend-menu-${item.id}`}
      accessibilityLabel={t('friend_more_actions', { name: item.friendUsername })}
      items={[
        ...(isFriend
          ? [
              {
                id: 'unfriend',
                label: t('friend_unfriend'),
                icon: 'person-remove-outline' as const,
                destructive: true,
                onPress: onUnfriend,
              },
            ]
          : []),
        {
          id: 'block',
          label: t('friend_block'),
          icon: 'ban-outline' as const,
          destructive: true,
          onPress: onBlock,
        },
      ]}
    />
  );

  return (
    <View style={[cardStyles.cardContainer, styles.card, isBlocked && styles.blocked]}>
      <View style={styles.main}>
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={item.friendUsername}
          style={styles.info}
        >
          <Avatar
            color={item.otherUserAvatarColor}
            icon={item.otherUserAvatarIcon}
            seed={item.otherUserId}
            size={44}
          />
          <View style={styles.texts}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </Pressable>

        {isFriend && (
          <View style={styles.actions}>
            <FriendChatButton
              serverId={item.serverId}
              friendUserId={item.otherUserId}
              friendName={item.friendUsername}
              onPress={onChat}
              style={styles.iconButton}
            />
            {blockMenu}
          </View>
        )}
        {isSent && (
          <Button variant="secondary" onPress={onCancel} style={styles.compactButton}>
            {t('friend_cancel_request')}
          </Button>
        )}
        {canUnblock && (
          <Button variant="secondary" onPress={onUnblock} style={styles.compactButton}>
            {t('friend_unblock')}
          </Button>
        )}
      </View>

      {isReceived && (
        <View style={styles.answers}>
          <Button onPress={onAccept} style={styles.answer} testID={`friend-accept-${item.id}`}>
            {t('friend_accept')}
          </Button>
          <Button
            variant="secondary"
            onPress={onDecline}
            style={styles.answer}
            testID={`friend-decline-${item.id}`}
          >
            {t('friend_decline')}
          </Button>
          {blockMenu}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { marginBottom: 10, padding: 14 },
  blocked: { opacity: 0.75 },
  main: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  info: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  texts: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: '600' },
  subtitle: { fontSize: 13, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconButton: { padding: 8 },
  compactButton: { paddingVertical: 8, paddingHorizontal: 12 },
  answers: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  answer: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
});

export default FriendshipRow;
