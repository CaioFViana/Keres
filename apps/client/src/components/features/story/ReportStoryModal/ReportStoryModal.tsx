import { MESSAGE_BODY_MAX_LENGTH } from '@keres/shared/metadata/MessageLimits';
import { REPORT_TYPES, type ReportType } from '@keres/shared';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ThemeColors } from '@/src/theme';
import { getCommonInputStyles, useTheme } from '@/src/theme';
import { fontSize, space } from '@/src/theme/tokens';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import Button from '@/src/components/common/controls/Button/Button';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import ModalHeader from '@/src/components/layout/ModalHeader/ModalHeader';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';

export interface ReportStoryModalProps {
  visible: boolean;
  sending: boolean;
  storyTitle: string;
  onClose: () => void;
  /** Sends the reason and type; resolves to whether it went through (and so whether to close). */
  onSend: (reason: string, type: ReportType) => Promise<boolean>;
}

// Static label keys on purpose: the locale checker only sees literal `t('...')` calls.
const TYPE_LABEL_KEYS = {
  intimate: 'report_type_intimate',
  copyright: 'report_type_copyright',
  spam_abuse: 'report_type_spam_abuse',
  illegal: 'report_type_illegal',
  other: 'report_type_other',
} as const satisfies Record<ReportType, string>;

/** The reason and type behind a story report: the story id travels server-side. */
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
  const [reportType, setReportType] = useState<ReportType>('other');
  const canSend = !sending && reason.trim().length > 0;

  const submit = async () => {
    if (!canSend) return;
    if (await onSend(reason.trim(), reportType)) {
      setReason('');
      setReportType('other');
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
        <Text style={styles.typeLabel}>{t('report_type_label')}</Text>
        {REPORT_TYPES.map((value) => {
          const selected = reportType === value;
          return (
            <TouchableOpacity
              key={value}
              testID={`report-type-${value}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => setReportType(value)}
              style={styles.typeRow}
            >
              <Text style={styles.typeText}>
                {selected ? '● ' : '○ '}
                {t(TYPE_LABEL_KEYS[value])}
              </Text>
            </TouchableOpacity>
          );
        })}
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
    typeLabel: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.text },
    typeRow: { paddingVertical: 4 },
    typeText: { fontSize: fontSize.base, color: colors.text },
    input: { minHeight: 96, textAlignVertical: 'top' },
    counter: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'right' },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.md },
  });

export default ReportStoryModal;
