import { Ionicons } from '@expo/vector-icons';
import { getOnColorForFill } from '@keres/shared';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ThemeColors } from '../../../theme';
import { getCommonInputStyles, useTheme } from '../../../theme';
import TextInput from '../../common/inputs/TextInput/TextInput';

export interface MessageComposerProps {
  maxLength: number;
  sending: boolean;
  /** What the user may still send today; `null` when nothing limits them. */
  remainingToday: number | null;
  /** Sends the text; resolves to whether it went through (and so whether to clear the field). */
  onSend: (body: string) => Promise<boolean>;
}

/** The field a message is written in: counter, what is left of today's allowance, and the send button. */
const MessageComposer: React.FC<MessageComposerProps> = ({
  maxLength,
  sending,
  remainingToday,
  onSend,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const inputStyles = useMemo(() => getCommonInputStyles(colors), [colors]);
  const [text, setText] = useState('');
  const blocked = remainingToday !== null && remainingToday <= 0;
  const canSend = !sending && !blocked && text.trim().length > 0;

  const submit = async () => {
    if (!canSend) return;
    if (await onSend(text.trim())) {
      setText('');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <View style={styles.inputWrapper}>
          <TextInput
            value={text}
            onChangeText={(next) => setText(next.slice(0, maxLength))}
            placeholder={t('message_placeholder')}
            accessibilityLabel={t('message_placeholder')}
            style={[inputStyles.multiline, styles.input]}
            multiline
            maxLength={maxLength}
          />
        </View>
        <TouchableOpacity
          onPress={() => void submit()}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={t('message_send')}
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
        >
          <Ionicons name="send" size={20} color={getOnColorForFill(colors, colors.primary)} />
        </TouchableOpacity>
      </View>
      <View style={styles.footer}>
        <Text style={styles.hint}>
          {blocked
            ? t('message_limit_reached')
            : remainingToday !== null
              ? t('message_remaining_today', { count: remainingToday })
              : ''}
        </Text>
        <Text style={styles.hint}>
          {text.length}/{maxLength}
        </Text>
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    inputWrapper: { flex: 1, minWidth: 0 },
    input: { minHeight: 44, maxHeight: 140 },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    sendButtonDisabled: { opacity: 0.5 },
    footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    hint: { fontSize: 12, color: colors.textSecondary },
  });

export default MessageComposer;
