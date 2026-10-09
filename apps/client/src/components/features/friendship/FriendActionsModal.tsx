import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useTheme } from '../../../theme';

export interface FriendAction {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** What ends something (remove, block): drawn in the error color. */
  destructive?: boolean;
  onPress: () => void;
}

interface FriendActionsModalProps {
  visible: boolean;
  onClose: () => void;
  friendName: string;
  actions: readonly FriendAction[];
}

/**
 * The actions a friendship has besides its main one, each with an icon and its word, in the app's own
 * modal. Choosing one closes the dialog first and then runs it: what ends something asks for its own
 * confirmation next, so a slip here costs a tap on "Cancel".
 */
const FriendActionsModal: React.FC<FriendActionsModalProps> = ({
  visible,
  onClose,
  friendName,
  actions,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onClose}
      keyboardAvoiding={false}
      contentStyle={styles.content}
    >
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {friendName}
      </Text>
      <View>
        {actions.map((action) => {
          const color = action.destructive ? colors.error : colors.text;
          return (
            <Pressable
              key={action.id}
              testID={`friend-action-${action.id}`}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={() => {
                onClose();
                action.onPress();
              }}
              style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name={action.icon} size={22} color={color} />
              <Text style={[styles.label, { color }]}>{action.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Button variant="secondary" onPress={onClose} testID="friend-actions-cancel">
        {t('cancel')}
      </Button>
    </ResponsiveModal>
  );
};

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8 },
  title: { fontSize: 18, fontWeight: '700' },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    minHeight: 48,
  },
  label: { fontSize: 16 },
});

export default FriendActionsModal;
