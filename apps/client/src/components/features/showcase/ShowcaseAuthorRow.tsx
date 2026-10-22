import { Ionicons } from '@expo/vector-icons';
import type { ShowcaseAuthorCard } from '@keres/shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Avatar from '@/src/components/common/display/Avatar/Avatar';
import { useTheme } from '@/src/theme';

interface ShowcaseAuthorRowProps {
  author: ShowcaseAuthorCard;
  onPress: () => void;
}

/** An author of the public site in a list: who they are and how many stories they have on show. */
const ShowcaseAuthorRow: React.FC<ShowcaseAuthorRowProps> = ({ author, onPress }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { owner } = author;

  return (
    <Pressable
      testID={`showcase-author-${owner.username}`}
      accessibilityRole="button"
      accessibilityLabel={owner.username}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderColor: colors.border, backgroundColor: colors.surface },
        pressed && styles.pressed,
      ]}
    >
      <Avatar color={owner.avatarColor} icon={owner.avatarIcon} seed={owner.username} size={44} />
      <View style={styles.texts}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {owner.username}
        </Text>
        <Text style={[styles.detail, { color: colors.textSecondary }]} numberOfLines={1}>
          {`@${owner.tag} · ${t('showcase_story_count', { count: author.storyCount })}`}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  pressed: { opacity: 0.7 },
  texts: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: '600' },
  detail: { fontSize: 13, marginTop: 2 },
});

export default ShowcaseAuthorRow;
