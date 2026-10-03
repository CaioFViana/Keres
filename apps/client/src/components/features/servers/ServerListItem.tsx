import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../../../theme';
import { useTheme } from '../../../theme';
import type { ServerStatusPillStatus } from './ServerStatusPill';
import ServerStatusPill from './ServerStatusPill';

export interface ServerListItemProps {
  name: string;
  url: string;
  userName: string;
  /** The user's @tag on this server, without the `@`; `null` when none is set. */
  tag: string | null;
  /** Already formatted; `null` when it never synchronised. */
  lastSync: string | null;
  status: ServerStatusPillStatus;
  apiVersion: string | null;
  /** The server's administrators wrote something the user has not opened. */
  hasUnseenAdminMessage?: boolean;
  onPress: () => void;
}

/**
 * A server of the list: where it is, who the user is there, and whether it answers. Nothing to
 * operate here - the server's own screen has everything the user can do with it.
 */
const ServerListItem: React.FC<ServerListItemProps> = ({
  name,
  url,
  userName,
  tag,
  lastSync,
  status,
  apiVersion,
  hasUnseenAdminMessage,
  onPress,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        hasUnseenAdminMessage ? `${name}. ${t('messages_unseen_admin_on', { server: name })}` : name
      }
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <ServerStatusPill status={status} apiVersion={apiVersion} />
          {hasUnseenAdminMessage ? (
            <View style={styles.unseen} testID="server-unseen-admin">
              <Ionicons name="chatbubble-ellipses" size={16} color={colors.error} />
              <Text style={styles.unseenText}>{t('messages_unseen_admin_short')}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.url} numberOfLines={1}>
          {url}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {t('server_user_label', { name: userName })}
          {' · '}
          {tag ? `@${tag}` : t('no_tag_set')}
        </Text>
        {lastSync ? (
          <Text style={styles.meta}>
            {t('last_sync')}: {lastSync}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </Pressable>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 15,
      marginBottom: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    cardPressed: { opacity: 0.85 },
    body: { flex: 1, minWidth: 0, gap: 3 },
    titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    name: { flexShrink: 1, fontSize: 18, fontWeight: 'bold', color: colors.text },
    url: { fontSize: 14, color: colors.textSecondary },
    meta: { fontSize: 12, color: colors.textSecondary },
    unseen: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    unseenText: { fontSize: 12, fontWeight: '600', color: colors.error },
  });

export default ServerListItem;
