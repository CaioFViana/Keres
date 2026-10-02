import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useUnseenMessagesStore } from '../../../state/unseenMessagesStore';
import { useTheme } from '../../../theme';

interface FriendshipDrawerIconProps {
  color: string;
  size: number;
}

/**
 * The friendships entry of the menu: the usual people icon, and - while there is a message the user has
 * not opened - a small received-message mark on its corner. It is how a notification that was missed
 * still leaves a trace.
 */
const FriendshipDrawerIcon: React.FC<FriendshipDrawerIconProps> = ({ color, size }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const hasUnseen = useUnseenMessagesStore((state) => Object.keys(state.unseen).length > 0);

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityLabel={hasUnseen ? t('messages_unseen') : undefined}
    >
      <Ionicons name="people-outline" color={color} size={size} />
      {hasUnseen ? (
        <View
          testID="unseen-messages-mark"
          style={[styles.mark, { backgroundColor: colors.background }]}
        >
          <Ionicons name="chatbubble" color={colors.error} size={Math.round(size * 0.6)} />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  mark: {
    position: 'absolute',
    top: -5,
    right: -7,
    borderRadius: 999,
    padding: 1,
  },
});

export default FriendshipDrawerIcon;
