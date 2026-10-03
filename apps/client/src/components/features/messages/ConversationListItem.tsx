import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../theme';
import type { ThemeColors } from '../../../theme';
import Avatar from '../../common/display/Avatar/Avatar';
import UnseenMark from './UnseenMark';

export interface ConversationListItemProps {
  /** The friend's name, or the words for "the administrators". */
  title: string;
  /** `@tag · server` - who exactly, and where. */
  subtitle: string;
  /** The last message, already prefixed with "You: " when it was the user's. */
  preview: string;
  /** The last message's time, already formatted. */
  when: string;
  /** The administrators have a fixed look; a friend brings their avatar. */
  isAdmin: boolean;
  avatar: { color: string | null; icon: string | null; seed: string };
  /** The other side wrote something the user has not opened. */
  unseen?: boolean;
  /** What a screen reader says of an unopened conversation ("New message from ..."). */
  unseenLabel?: string;
  onPress: () => void;
}

/** One conversation of the inbox: who it is with, and how it last ended. */
const ConversationListItem: React.FC<ConversationListItemProps> = ({
  title,
  subtitle,
  preview,
  when,
  isAdmin,
  avatar,
  unseen,
  unseenLabel,
  onPress,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={unseen && unseenLabel ? unseenLabel : title}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <Avatar
        color={isAdmin ? colors.primary : avatar.color}
        icon={isAdmin ? 'ion:shield-checkmark-outline' : avatar.icon}
        seed={avatar.seed}
        size={44}
      />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, unseen && styles.titleUnseen]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.when}>{when}</Text>
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
        <Text style={[styles.preview, unseen && styles.previewUnseen]} numberOfLines={2}>
          {preview}
        </Text>
      </View>
      {unseen ? (
        <UnseenMark testID="conversation-unseen-mark" offset={{ top: 8, right: 8 }} />
      ) : null}
    </Pressable>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      marginBottom: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    cardPressed: { opacity: 0.85 },
    body: { flex: 1, minWidth: 0 },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    title: { flexShrink: 1, fontSize: 16, fontWeight: 'bold', color: colors.text },
    when: { fontSize: 12, color: colors.textSecondary },
    subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
    preview: { fontSize: 14, color: colors.text, marginTop: 4 },
    titleUnseen: { color: colors.primary },
    previewUnseen: { fontWeight: '600' },
  });

export default ConversationListItem;
