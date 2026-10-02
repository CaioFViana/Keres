import { Ionicons } from '@expo/vector-icons';
import { getOnColorForFill } from '@keres/shared';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ThemeColors } from '../../../theme';
import { useTheme } from '../../../theme';

export interface MessageBubbleProps {
  body: string;
  /** The user's own messages sit on the right, in the brand colour; the other side's on the left. */
  mine: boolean;
  /** Already formatted. */
  when: string;
  onDelete: () => void;
}

/** One message of a conversation. */
const MessageBubble: React.FC<MessageBubbleProps> = ({ body, mine, when, onDelete }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors, mine), [colors, mine]);
  const onFill = mine ? getOnColorForFill(colors, colors.primary) : colors.textSecondary;

  return (
    <View style={styles.row}>
      <View style={styles.bubble}>
        <Text style={styles.body} selectable>
          {body}
        </Text>
        <View style={styles.meta}>
          <Text style={[styles.when, { color: onFill }]}>{when}</Text>
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('message_delete_title')}
          >
            <Ionicons name="trash-outline" size={14} color={onFill} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors, mine: boolean) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      justifyContent: mine ? 'flex-end' : 'flex-start',
      marginBottom: 8,
    },
    bubble: {
      maxWidth: '82%',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: mine ? 0 : 1,
      borderColor: colors.border,
      backgroundColor: mine ? colors.primary : colors.card,
    },
    body: {
      fontSize: 15,
      lineHeight: 21,
      color: mine ? getOnColorForFill(colors, colors.primary) : colors.text,
    },
    meta: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 10,
      marginTop: 4,
    },
    when: { fontSize: 11 },
  });

export default MessageBubble;
