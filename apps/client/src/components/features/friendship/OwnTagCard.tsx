import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ServerSelect } from '../../../db/schemas/servers';
import { useNotificationStore } from '../../../state/notificationStore';
import { useTheme } from '../../../theme';

interface OwnTagCardProps {
  servers: readonly ServerSelect[];
}

/**
 * The person's own @tag on each server they are registered on, with a button to copy it: friends are
 * added by tag, so the screen that adds them is where to find the one to hand out.
 */
const OwnTagCard: React.FC<OwnTagCardProps> = ({ servers }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showNotification } = useNotificationStore();
  const tagged = servers.filter((server) => !!server.tag);
  if (tagged.length === 0) return null;

  const copy = async (tag: string) => {
    await Clipboard.setStringAsync(`@${tag}`);
    showNotification(t('friend_tag_copied'), 'success');
  };

  return (
    <View
      testID="own-tag-card"
      style={[
        styles.card,
        { backgroundColor: colors.primaryContainer, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.label, { color: colors.onPrimaryContainer }]}>
        {t('friend_your_tag')}
      </Text>
      {tagged.map((server) => (
        <View key={server.id} style={styles.line}>
          <View style={styles.tagText}>
            <Text style={[styles.tag, { color: colors.onPrimaryContainer }]} selectable>
              @{server.tag}
            </Text>
            {tagged.length > 1 ? (
              <Text style={[styles.server, { color: colors.onPrimaryContainer }]} numberOfLines={1}>
                {server.name}
              </Text>
            ) : null}
          </View>
          <Pressable
            testID={`copy-tag-${server.id}`}
            accessibilityRole="button"
            accessibilityLabel={t('friend_copy_tag')}
            onPress={() => void copy(server.tag as string)}
            hitSlop={6}
            style={({ pressed }) => [styles.copy, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="copy-outline" size={20} color={colors.onPrimaryContainer} />
          </Pressable>
        </View>
      ))}
      <Text style={[styles.hint, { color: colors.onPrimaryContainer }]}>
        {t('friend_your_tag_hint')}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 10, borderWidth: 1, padding: 14, marginBottom: 14, gap: 4 },
  label: { fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', opacity: 0.85 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tagText: { flex: 1, minWidth: 0 },
  tag: { fontSize: 20, fontWeight: 'bold' },
  server: { fontSize: 13, opacity: 0.85 },
  copy: { minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 13, opacity: 0.85, marginTop: 2 },
});

export default OwnTagCard;
