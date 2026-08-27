import Button from '@/src/components/common/controls/Button/Button';
import Select from '@/src/components/common/inputs/Select/Select';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { CHAPTER_RELATION_TYPES, type ChapterRelationType } from '@keres/shared';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../../theme';

/**
 * Stating when this container happened, relative to another one.
 *
 * The direction is part of what is said, so the sentence is built in front of the writer rather than
 * left implicit in two dropdowns: "The war — happened before — Chapter 4". A relation stored the
 * wrong way round is not a cosmetic error, it is the opposite claim.
 */

export interface ChronologyTarget {
  id: string;
  name: string;
  isEvent: boolean;
}

interface ChronologyModalProps {
  visible: boolean;
  /** The container this is being stated about - always the subject of the sentence. */
  subjectName: string;
  /** Containers with no statement about this one yet; a pair holds only one. */
  targets: ChronologyTarget[];
  /** Present when editing: the modal opens on what was already said. */
  initial?: { targetId: string; relationType: ChapterRelationType } | null;
  onCancel: () => void;
  onConfirm: (targetId: string, relationType: ChapterRelationType) => void;
}

const ChronologyModal: React.FC<ChronologyModalProps> = ({
  visible,
  subjectName,
  targets,
  initial,
  onCancel,
  onConfirm,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [targetId, setTargetId] = useState<string | null>(null);
  const [relationType, setRelationType] = useState<ChapterRelationType>('before');

  useEffect(() => {
    setTargetId(initial?.targetId ?? (targets.length === 1 ? targets[0]!.id : null));
    setRelationType(initial?.relationType ?? 'before');
  }, [visible, initial, targets]);

  const styles = StyleSheet.create({
    modalContent: { backgroundColor: colors.background, borderRadius: 10, padding: 20 },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    formGroup: { marginBottom: 15 },
    label: { fontSize: 16, color: colors.text, marginBottom: 5 },
    sentence: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 22,
      marginBottom: 16,
      textAlign: 'center',
    },
    subject: { color: colors.text, fontWeight: 'bold' },
    hint: { fontSize: 12, color: colors.textSecondary, marginTop: 6, lineHeight: 17 },
    buttonContainer: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 },
  });

  const targetName = targets.find((target) => target.id === targetId)?.name;

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onCancel}
      contentStyle={styles.modalContent}
      maxHeight="86%"
    >
      <Text style={styles.modalTitle}>{t('chronology_title')}</Text>

      {/* The sentence as it will be stored, so the direction is impossible to get wrong by accident. */}
      <Text style={styles.sentence}>
        <Text style={styles.subject}>{subjectName}</Text>
        {` ${t(`chronology_type_${relationType}`)} `}
        <Text style={styles.subject}>{targetName ?? t('chronology_pick_target')}</Text>
      </Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>{t('chronology_relation')}</Text>
        <Select
          options={CHAPTER_RELATION_TYPES.map((type) => ({
            label: t(`chronology_type_${type}`),
            value: type,
          }))}
          value={relationType}
          onValueChange={(value) => value && setRelationType(value as ChapterRelationType)}
          multiple={false}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>{t('chronology_target')}</Text>
        <Select
          options={targets.map((target) => ({
            // The hourglass marks an event, the same sign the container lists use.
            label: target.isEvent ? `⏳ ${target.name}` : target.name,
            value: target.id,
          }))}
          value={targetId}
          onValueChange={setTargetId}
          placeholder={t('chronology_pick_target')}
          multiple={false}
        />
        <Text style={styles.hint}>{t('chronology_hint')}</Text>
      </View>

      <View style={styles.buttonContainer}>
        <Button onPress={onCancel}>{t('cancel')}</Button>
        <Button
          onPress={() => targetId && onConfirm(targetId, relationType)}
          disabled={!targetId}
          testID="confirm-chronology"
        >
          {t('save')}
        </Button>
      </View>
    </ResponsiveModal>
  );
};

export default ChronologyModal;
