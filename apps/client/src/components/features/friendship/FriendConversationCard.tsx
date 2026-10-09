import { Ionicons } from '@expo/vector-icons';
import type { ChatMessage } from '@keres/shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../theme';

interface FriendConversationCardProps {
  message: ChatMessage;
  /** The other side wrote something the person has not opened. */
  unseen: boolean;
  onPress: () => void;
}

/** How the conversation with a friend last ended, as a card that opens it. */
const FriendConversationCard: React.FC<FriendConversationCardProps> = ({
  message,
  unseen,
  onPress,
}) => {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const when = new Date(message.createdAt).toLocaleString(i18n.language, {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return (
    <View testID="friend-conversation">
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {t('friend_conversation_title')}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('friend_continue_conversation')}
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          { borderColor: colors.border, backgroundColor: colors.surface },
          pressed && styles.pressed,
        ]}
      >
        <Ionicons
          name={unseen ? 'chatbubble-ellipses' : 'chatbubble-outline'}
          size={24}
          color={colors.primary}
        />
        <View style={styles.texts}>
          <Text
            style={[styles.preview, { color: colors.text }, unseen && styles.unseen]}
            numberOfLines={2}
          >
            {message.mine ? t('messages_you', { text: message.body }) : message.body}
          </Text>
          <Text style={[styles.when, { color: colors.textSecondary }]}>{when}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  pressed: { opacity: 0.7 },
  texts: { flex: 1, minWidth: 0 },
  preview: { fontSize: 15 },
  unseen: { fontWeight: 'bold' },
  when: { fontSize: 12, marginTop: 2 },
});

export default FriendConversationCard;
