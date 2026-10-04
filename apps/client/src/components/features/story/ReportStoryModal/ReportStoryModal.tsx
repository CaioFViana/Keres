import { MESSAGE_BODY_MAX_LENGTH } from '@keres/shared/metadata/MessageLimits';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../../../../theme';
import { getCommonInputStyles, useTheme } from '../../../../theme';
import Button from '../../../common/controls/Button/Button';
import TextInput from '../../../common/inputs/TextInput/TextInput';

export interface ReportStoryModalProps {
  visible: boolean;
  sending: boolean;
  storyTitle: string;
  onClose: () => void;
  /** Sends the reason; resolves to whether it went through (and so whether to close). */
  onSend: (reason: string) => Promise<boolean>;
}

/** The reason behind a story report: a reason-only dialog, the story id travels server-side. */
const ReportStoryModal: React.FC<ReportStoryModalProps> = ({
  visible,
  sending,
  storyTitle,
  onClose,
  onSend,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const inputStyles = useMemo(() => getCommonInputStyles(colors), [colors]);
  const [reason, setReason] = useState('');
  const canSend = !sending && reason.trim().length > 0;

  const submit = async () => {
    if (!canSend) return;
    if (await onSend(reason.trim())) {
      setReason('');
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.panel}>
          <Text style={styles.title}>{t('report_story_title')}</Text>
          <Text style={styles.description}>
            {t('report_story_description', { title: storyTitle })}
          </Text>
          <TextInput
            value={reason}
            onChangeText={(next) => setReason(next.slice(0, MESSAGE_BODY_MAX_LENGTH))}
            placeholder={t('report_reason_placeholder')}
            accessibilityLabel={t('report_reason_placeholder')}
            style={[inputStyles.multiline, styles.input]}
            multiline
            maxLength={MESSAGE_BODY_MAX_LENGTH}
            testID="report-reason-input"
          />
          <Text style={styles.counter}>
            {reason.length}/{MESSAGE_BODY_MAX_LENGTH}
          </Text>
          <View style={styles.actions}>
            <Button onPress={onClose} disabled={sending} testID="report-cancel">
              {t('cancel')}
            </Button>
            <Button onPress={() => void submit()} disabled={!canSend} testID="report-send">
              {t('report_send')}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      padding: 24,
    },
    panel: {
      width: '100%',
      maxWidth: 480,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 20,
      gap: 12,
    },
    title: { fontSize: 18, fontWeight: '700', color: colors.text },
    description: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
    input: { minHeight: 96, textAlignVertical: 'top' },
    counter: { fontSize: 12, color: colors.textSecondary, textAlign: 'right' },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  });

export default ReportStoryModal;
