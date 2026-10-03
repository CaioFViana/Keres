import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useIsConversationUnseen } from '../../../state/unseenMessagesStore';
import { useTheme } from '../../../theme';
import { directConversationKey } from '../../../utils/conversationKey';
import UnseenMark from './UnseenMark';

export interface FriendChatButtonProps {
  serverId: string;
  /** The friend's id on that server. */
  friendUserId: string;
  friendName: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * The button that opens the conversation with one friend. When that friend has written something the user
 * has not opened, it says so itself - a filled bubble with a dot, and a label that names the friend - so the
 * list shows which chat has news, not only that some chat does.
 */
const FriendChatButton: React.FC<FriendChatButtonProps> = ({
  serverId,
  friendUserId,
  friendName,
  onPress,
  style,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const unseen = useIsConversationUnseen(directConversationKey(serverId, friendUserId));

  return (
    <TouchableOpacity
      onPress={onPress}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={
        unseen ? t('messages_unseen_from', { name: friendName }) : t('send_message')
      }
    >
      <View style={styles.icon}>
        <Ionicons
          name={unseen ? 'chatbubble-ellipses' : 'chatbubble-outline'}
          size={24}
          color={colors.primary}
        />
        {unseen ? <UnseenMark testID="friend-unseen-mark" /> : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  icon: { width: 24, height: 24 },
});

export default FriendChatButton;
