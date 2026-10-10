import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import type { ServerSelect } from '../../../db/schemas/servers';
import { useNotificationStore } from '../../../state/notificationStore';
import { useTheme } from '../../../theme';

interface ServerFriendsHeaderProps {
  server: ServerSelect;
  onAddFriend: () => void;
}

/**
 * Where one server's friends begin. Friendships belong to a server: the same @tag on two servers is two
 * people, and the person is not the same either (each server knows them by its own @tag), so every server
 * gets its own header with the person's @tag there - to copy and hand out - and its own way to add a friend.
 */
const ServerFriendsHeader: React.FC<ServerFriendsHeaderProps> = ({ server, onAddFriend }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showNotification } = useNotificationStore();

  const copy = async (tag: string) => {
    await Clipboard.setStringAsync(`@${tag}`);
    showNotification(t('friend_tag_copied'), 'success');
  };

  return (
    <View
      testID={`server-friends-${server.id}`}
      style={[
        styles.header,
        { backgroundColor: colors.primaryContainer, borderColor: colors.border },
      ]}
    >
      <Ionicons name="cloud-outline" size={24} color={colors.onPrimaryContainer} />
      <View style={styles.texts}>
        <Text
          accessibilityRole="header"
          style={[styles.name, { color: colors.onPrimaryContainer }]}
          numberOfLines={1}
        >
          {server.name}
        </Text>
        {server.tag ? (
          <View style={styles.tagLine}>
            <Text style={[styles.tag, { color: colors.onPrimaryContainer }]} selectable>
              {t('friend_your_tag')}: @{server.tag}
            </Text>
            <Pressable
              testID={`copy-tag-${server.id}`}
              accessibilityRole="button"
              accessibilityLabel={t('friend_copy_tag')}
              onPress={() => void copy(server.tag as string)}
              hitSlop={8}
              style={({ pressed }) => [styles.copy, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="copy-outline" size={18} color={colors.onPrimaryContainer} />
            </Pressable>
          </View>
        ) : null}
      </View>
      <Button
        variant="secondary"
        onPress={onAddFriend}
        testID={`add-friend-${server.id}`}
        style={styles.add}
      >
        {t('friends_empty_add')}
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 18,
    marginBottom: 10,
  },
  texts: { flex: 1, minWidth: 160 },
  name: { fontSize: 16, fontWeight: 'bold' },
  tagLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  tag: { fontSize: 14 },
  copy: { minWidth: 28, minHeight: 28, alignItems: 'center', justifyContent: 'center' },
  add: { paddingVertical: 8, paddingHorizontal: 14 },
});

export default ServerFriendsHeader;
