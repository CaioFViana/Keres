import { MESSAGE_BODY_MAX_LENGTH } from '@keres/shared/metadata/MessageLimits';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../../../../theme';
import { getCommonInputStyles, useTheme } from '../../../../theme';
import { fontSize, space } from '../../../../theme/tokens';
import { useThemedStyles } from '../../../../theme/useThemedStyles';
import Button from '../../../common/controls/Button/Button';
import TextInput from '../../../common/inputs/TextInput/TextInput';
import ModalHeader from '../../../layout/ModalHeader/ModalHeader';
import ResponsiveModal from '../../../layout/ResponsiveModal/ResponsiveModal';

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
  const styles = useThemedStyles(createStyles);
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
    <ResponsiveModal
      visible={visible}
      onClose={onClose}
      inset="roomy"
      tone="raised"
      contentStyle={styles.dialog}
    >
      <ModalHeader title={t('report_story_title')} />
      <View style={styles.body}>
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
    </ResponsiveModal>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    dialog: { maxWidth: 480 },
    body: { gap: space.lg },
    description: { fontSize: fontSize.base, color: colors.textSecondary, lineHeight: 20 },
    input: { minHeight: 96, textAlignVertical: 'top' },
    counter: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'right' },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.md },
  });

export default ReportStoryModal;
