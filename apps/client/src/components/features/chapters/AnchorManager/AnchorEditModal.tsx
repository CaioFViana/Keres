import Button from '@/src/components/common/controls/Button/Button';
import Select from '@/src/components/common/inputs/Select/Select';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import type { ScenePosition } from '@keres/shared';
import { SCENE_POSITIONS } from '@keres/shared';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../theme';

/**
 * One stretch of story time: from a moment to a moment.
 *
 * A moment is deliberately small to state - a scene, a place inside it, and optionally a distance
 * from there. The scene is the part the writer already knows; everything else has a default that
 * reads correctly if left alone. The distance exists for the thing no scene can express: an event
 * that happened long before anything the story shows.
 */

export interface AnchorDraft {
  startSceneId: string | null;
  startPosition: ScenePosition;
  startOffset: number | null;
  startOffsetUnit: string | null;
  endSceneId: string | null;
  endPosition: ScenePosition;
  endOffset: number | null;
  endOffsetUnit: string | null;
}

export interface AnchorSceneOption {
  id: string;
  label: string;
}

interface Props {
  visible: boolean;
  /** Empty when adding; the current values when editing. */
  initial?: AnchorDraft;
  scenes: AnchorSceneOption[];
  onCancel: () => void;
  onConfirm: (draft: AnchorDraft) => void;
}

const emptyDraft = (): AnchorDraft => ({
  startSceneId: null,
  startPosition: 'start',
  startOffset: null,
  startOffsetUnit: null,
  endSceneId: null,
  endPosition: 'end',
  endOffset: null,
  endOffsetUnit: null,
});

const AnchorEditModal: React.FC<Props> = ({ visible, initial, scenes, onCancel, onConfirm }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [draft, setDraft] = useState<AnchorDraft>(emptyDraft);
  /*
   * The offset is kept as typed text as well as a number.
   *
   * Its sign is not something the writer types: they pick "before" or "after", and a half-finished
   * entry would otherwise round-trip through `Number` into a 0 that reads as "at that moment".
   */
  const [startAmount, setStartAmount] = useState('');
  const [endAmount, setEndAmount] = useState('');

  useEffect(() => {
    const next = initial ?? emptyDraft();
    setDraft(next);
    setStartAmount(next.startOffset ? String(Math.abs(next.startOffset)) : '');
    setEndAmount(next.endOffset ? String(Math.abs(next.endOffset)) : '');
  }, [initial, visible]);

  const unitOptions = useMemo(
    () =>
      ['seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years', 'millennia', 'eons'].map(
        (unit) => ({ label: t(unit), value: unit }),
      ),
    [t],
  );
  const sceneOptions = useMemo(
    () => scenes.map((scene) => ({ label: scene.label, value: scene.id })),
    [scenes],
  );

  const styles = StyleSheet.create({
    modalContent: { backgroundColor: colors.background, borderRadius: 10, padding: 20 },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 6,
      textAlign: 'center',
    },
    subtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 18, textAlign: 'center' },
    group: { marginBottom: 18 },
    label: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 6 },
    positions: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      overflow: 'hidden',
      marginTop: 8,
    },
    position: { flexGrow: 1, flexShrink: 1, paddingVertical: 8, alignItems: 'center' },
    positionText: { fontSize: 13, fontWeight: '700' },
    offsetRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    amount: { width: 70, marginBottom: 0 },
    hint: { fontSize: 12, color: colors.textSecondary, marginTop: 6, lineHeight: 17 },
    buttons: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  });

  const renderPoint = (edge: 'start' | 'end') => {
    const sceneId = edge === 'start' ? draft.startSceneId : draft.endSceneId;
    const position = edge === 'start' ? draft.startPosition : draft.endPosition;
    const unit = edge === 'start' ? draft.startOffsetUnit : draft.endOffsetUnit;
    const offset = edge === 'start' ? draft.startOffset : draft.endOffset;
    const amount = edge === 'start' ? startAmount : endAmount;
    const setAmount = edge === 'start' ? setStartAmount : setEndAmount;
    // Nothing stated yet is "after": a fresh offset counts forwards unless the writer says otherwise.
    const before = (offset ?? 0) < 0;

    const patch = (changes: Partial<AnchorDraft>) =>
      setDraft((current) => ({ ...current, ...changes }));
    const signed = (text: string, negative: boolean) => {
      const magnitude = Number(text);
      if (!text || Number.isNaN(magnitude) || magnitude === 0) return null;
      return negative ? -Math.abs(magnitude) : Math.abs(magnitude);
    };

    return (
      <View style={styles.group}>
        <Text style={styles.label}>{t(edge === 'start' ? 'anchor_starts' : 'anchor_ends')}</Text>
        <Select
          options={sceneOptions}
          value={sceneId}
          onValueChange={(value) =>
            patch(edge === 'start' ? { startSceneId: value } : { endSceneId: value })
          }
          placeholder={t('anchor_scene_placeholder')}
          multiple={false}
        />
        <View style={styles.positions}>
          {SCENE_POSITIONS.map((option) => {
            const selected = position === option;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.position, selected && { backgroundColor: colors.primaryContainer }]}
                onPress={() =>
                  patch(edge === 'start' ? { startPosition: option } : { endPosition: option })
                }
              >
                <Text
                  style={[
                    styles.positionText,
                    { color: selected ? colors.onPrimaryContainer : colors.textSecondary },
                  ]}
                >
                  {t(`scene_position_${option}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.offsetRow}>
          <TextInput
            placeholder={t('anchor_offset_placeholder')}
            value={amount}
            onChangeText={(text) => {
              if (text && !/^\d*$/.test(text)) return;
              setAmount(text);
              const value = signed(text, before);
              patch(
                edge === 'start'
                  ? { startOffset: value, startOffsetUnit: value === null ? null : unit }
                  : { endOffset: value, endOffsetUnit: value === null ? null : unit },
              );
            }}
            keyboardType="number-pad"
            style={styles.amount}
          />
          <View style={{ flexGrow: 1, flexShrink: 1 }}>
            <Select
              options={unitOptions}
              value={unit}
              onValueChange={(value) =>
                patch(
                  edge === 'start'
                    ? { startOffsetUnit: value, startOffset: signed(amount, before) }
                    : { endOffsetUnit: value, endOffset: signed(amount, before) },
                )
              }
              placeholder={t('anchor_offset_unit_placeholder')}
              multiple={false}
            />
          </View>
          <TouchableOpacity
            onPress={() => {
              const value = signed(amount, !before);
              patch(edge === 'start' ? { startOffset: value } : { endOffset: value });
            }}
            style={[
              styles.position,
              { flexGrow: 0, paddingHorizontal: 12, backgroundColor: colors.primaryContainer },
            ]}
          >
            <Text style={[styles.positionText, { color: colors.onPrimaryContainer }]}>
              {t(before ? 'anchor_direction_before' : 'anchor_direction_after')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const complete = Boolean(draft.startSceneId && draft.endSceneId);

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onCancel}
      contentStyle={styles.modalContent}
      maxHeight="86%"
    >
      <Text style={styles.title}>{t('anchor_modal_title')}</Text>
      <Text style={styles.subtitle}>{t('anchor_modal_subtitle')}</Text>
      {renderPoint('start')}
      {renderPoint('end')}
      <Text style={styles.hint}>{t('anchor_offset_hint')}</Text>
      <View style={styles.buttons}>
        <Button onPress={onCancel}>{t('cancel')}</Button>
        <Button onPress={() => onConfirm(draft)} disabled={!complete} testID="confirm-anchor">
          {t('save')}
        </Button>
      </View>
    </ResponsiveModal>
  );
};

export default AnchorEditModal;
