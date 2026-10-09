import { Ionicons } from '@expo/vector-icons';
import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Avatar from '@/src/components/common/display/Avatar/Avatar';
import type { FriendshipWithServer } from '../../../services/FriendshipService';
import { useTheme } from '../../../theme';

const STATUS_KEYS: Record<string, string> = {
  [FriendStatus.PENDING]: 'status_pending',
  [FriendStatus.FRIEND]: 'status_friend',
  [FriendStatus.BLACKLISTED]: 'status_blacklisted',
};

interface FriendProfileHeaderProps {
  friendship: FriendshipWithServer;
  /** Names of the person's other servers where the same @tag exists: a different person there. */
  alsoOn: string[];
}

/**
 * Who this is: avatar, name, @tag, the server they are on (the same @tag on another server is someone
 * else, so the server is part of who this is), where the friendship stands, and since when.
 */
const FriendProfileHeader: React.FC<FriendProfileHeaderProps> = ({ friendship, alsoOn }) => {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const since =
    friendship.status === FriendStatus.FRIEND && friendship.createdAt
      ? new Date(friendship.createdAt).toLocaleDateString(i18n.language, { dateStyle: 'medium' })
      : null;

  return (
    <View>
      <View style={styles.profile}>
        <Avatar
          color={friendship.otherUserAvatarColor}
          icon={friendship.otherUserAvatarIcon}
          seed={friendship.otherUserId}
          size={80}
        />
        <View style={styles.texts}>
          <Text style={[styles.username, { color: colors.text }]}>{friendship.friendUsername}</Text>
          {friendship.otherUserTag ? (
            <Text style={[styles.tag, { color: colors.textSecondary }]}>
              @{friendship.otherUserTag}
            </Text>
          ) : null}
          <View style={styles.meta}>
            <View
              style={[
                styles.serverChip,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
              testID="friend-server"
            >
              <Ionicons name="cloud-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.serverChipText, { color: colors.text }]}>
                {friendship.serverName || friendship.serverId}
              </Text>
            </View>
            <Text style={[styles.status, { color: colors.textSecondary }]}>
              {t(STATUS_KEYS[friendship.status] ?? 'status_blacklisted')}
            </Text>
          </View>
          {since ? (
            <Text style={[styles.fact, { color: colors.textSecondary }]} testID="friend-since">
              {t('friend_since', { date: since })}
            </Text>
          ) : null}
        </View>
      </View>
      {alsoOn.length > 0 && friendship.otherUserTag ? (
        <Text
          style={[styles.fact, styles.also, { color: colors.textSecondary }]}
          testID="friend-also-on"
        >
          {t('friend_also_on', { tag: friendship.otherUserTag, servers: alsoOn.join(', ') })}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  texts: { flex: 1, minWidth: 0 },
  username: { fontSize: 22, fontWeight: 'bold' },
  tag: { fontSize: 15, marginTop: 2 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 8 },
  serverChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  serverChipText: { fontSize: 13 },
  status: { fontSize: 13 },
  fact: { fontSize: 13, marginTop: 6 },
  also: { marginTop: 10 },
});

export default FriendProfileHeader;
