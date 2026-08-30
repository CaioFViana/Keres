import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import Button from '@/src/components/common/controls/Button/Button';
import Select from '@/src/components/common/inputs/Select/Select';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import type { ChapterType } from '@keres/shared';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../../theme';

/**
 * Turning a chapter into an event, or an event back into a chapter.
 *
 * The two directions are not symmetric, and the difference is the whole point of the feature. Going
 * to an event asks nothing: the event list is display order, so arriving at the end claims nothing
 * about when the thing happened. Coming back asks **where it falls**, because the narrative spine
 * has no neutral slot - every position is an assertion about the order the story is told in.
 */

interface ConvertContainerModalProps {
  visible: boolean;
  /** The container's name, so the question names what it is about. */
  name: string;
  currentType: ChapterType;
  /** The spine as it stands, used to offer the slots a returning chapter can take. */
  chapterNames: { id: string; name: string }[];
  onCancel: () => void;
  onConfirm: (targetType: ChapterType, position?: number) => void;
}

const ConvertContainerModal: React.FC<ConvertContainerModalProps> = ({
  visible,
  name,
  currentType,
  chapterNames,
  onCancel,
  onConfirm,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const becomingChapter = currentType === 'event';
  const lastSlot = chapterNames.length + 1;
  const [position, setPosition] = useState<string>(String(lastSlot));

  useEffect(() => {
    // The end of the spine every time it opens: the least surprising place, and the writer is being
    // shown the claim rather than having it made for them.
    setPosition(String(lastSlot));
  }, [visible, lastSlot]);

  const styles = StyleSheet.create({
    modalContent: { backgroundColor: colors.background, borderRadius: 10, padding: 20 },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 6,
      textAlign: 'center',
    },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 20, textAlign: 'center' },
    formGroup: { marginBottom: 15 },
    label: { fontSize: 16, color: colors.text, marginBottom: 5 },
    hint: { fontSize: 12, color: colors.textSecondary, marginTop: 6, lineHeight: 17 },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 20,
      paddingHorizontal: '3%',
    },
  });

  /**
   * One slot per gap in the spine, described by what it would sit before. "At the end" is the last
   * one - a position expressed as "before nothing" would read as a bug.
   */
  const slotOptions = [
    ...chapterNames.map((chapter, index) => ({
      label: t('chapter_convert_before', { name: chapter.name }),
      value: String(index + 1),
    })),
    { label: t('chapter_convert_at_end'), value: String(lastSlot) },
  ];

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onCancel}
      contentStyle={styles.modalContent}
      maxHeight="86%"
    >
      <Text style={styles.modalTitle}>
        {becomingChapter ? t('chapter_convert_to_chapter') : t('chapter_convert_to_event')}
      </Text>
      <Text style={styles.subtitle}>
        {becomingChapter
          ? t('chapter_convert_to_chapter_message', { name })
          : t('chapter_convert_to_event_message', { name })}
      </Text>

      {becomingChapter && (
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('chapter_convert_position')}</Text>
          <Select
            options={slotOptions}
            value={position}
            onValueChange={(value) => value && setPosition(value)}
            multiple={false}
          />
          <Text style={styles.hint}>{t('chapter_convert_position_hint')}</Text>
        </View>
      )}

      <FormActions>
        <Button onPress={onCancel}>{t('cancel')}</Button>
        <Button
          onPress={() =>
            onConfirm(
              becomingChapter ? 'chapter' : 'event',
              becomingChapter ? Number(position) : undefined,
            )
          }
          testID="confirm-convert-container"
        >
          {t('save')}
        </Button>
      </FormActions>
    </ResponsiveModal>
  );
};

export default ConvertContainerModal;
