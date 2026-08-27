import Button from '@/src/components/common/controls/Button/Button';
import Select from '@/src/components/common/inputs/Select/Select';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useResponsiveLayout } from '@/src/hooks/useResponsiveLayout';
import { getCommonInputStyles } from '@/src/theme/commonStyles';
import type { ScenePosition } from '@keres/shared';
import { SCENE_POSITIONS } from '@keres/shared';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../theme';

/**
 * One stretch of story time: from a moment, and optionally to a moment.
 *
 * The start is required. The end is a mode: either another moment on the spine, or the container's
 * own scenes measuring how long it lasts. A distance from the chosen scene is hidden until the
 * writer asks for it - most stretches sit on the story, not centuries away from it.
 */

export interface AnchorDraft {
  startSceneId: string | null;
  startPosition: ScenePosition;
  startOffset: number | null;
  startOffsetUnit: string | null;
  endSceneId: string | null;
  endPosition: ScenePosition | null;
  endOffset: number | null;
  endOffsetUnit: string | null;
}

export interface AnchorSceneOption {
  id: string;
  label: string;
}

type AnchorMode = 'closed' | 'open';

interface Props {
  visible: boolean;
  initial?: AnchorDraft;
  scenes: AnchorSceneOption[];
  hasContents: boolean;
  /** An open stretch cannot share a container with another. */
  allowOpenStretch: boolean;
  onCancel: () => void;
  onConfirm: (draft: AnchorDraft) => void;
}

const emptyDraft = (): AnchorDraft => ({
  startSceneId: null,
  startPosition: 'start',
  startOffset: null,
  startOffsetUnit: null,
  endSceneId: null,
  endPosition: null,
  endOffset: null,
  endOffsetUnit: null,
});

const AnchorEditModal: React.FC<Props> = ({
  visible,
  initial,
  scenes,
  hasContents,
  allowOpenStretch,
  onCancel,
  onConfirm,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { isCompact } = useResponsiveLayout();
  const commonInputStyles = getCommonInputStyles(colors);
  const [draft, setDraft] = useState<AnchorDraft>(emptyDraft);
  const [mode, setMode] = useState<AnchorMode>('open');
  const [startAmount, setStartAmount] = useState('');
  const [endAmount, setEndAmount] = useState('');
  const [showStartDistance, setShowStartDistance] = useState(false);
  const [showEndDistance, setShowEndDistance] = useState(false);

  useEffect(() => {
    const next = initial ?? emptyDraft();
    setDraft(next);
    setStartAmount(next.startOffset ? String(Math.abs(next.startOffset)) : '');
    setEndAmount(next.endOffset ? String(Math.abs(next.endOffset)) : '');
    const closed = Boolean(next.endSceneId);
    setMode(closed || !allowOpenStretch ? 'closed' : 'open');
    setShowStartDistance(Boolean(next.startOffset));
    setShowEndDistance(Boolean(next.endOffset));
  }, [allowOpenStretch, initial, visible]);

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
  const sceneName = (id: string | null) =>
    scenes.find((scene) => scene.id === id)?.label ?? t('common_na');

  const describePoint = (
    sceneId: string | null,
    position: ScenePosition | null,
    offset: number | null,
    offsetUnit: string | null,
  ) => {
    if (!sceneId) return t('anchor_scene_placeholder');
    const at = t('anchor_point_at', {
      position: t(`scene_position_${position ?? 'start'}`),
      scene: sceneName(sceneId),
    });
    if (!offset || !offsetUnit) return at;
    return t('anchor_point_offset', {
      amount: Math.abs(offset),
      unit: t(offsetUnit),
      direction: t(offset < 0 ? 'anchor_direction_before' : 'anchor_direction_after'),
      at,
    });
  };

  const preview = (() => {
    const from = describePoint(
      draft.startSceneId,
      draft.startPosition,
      draft.startOffset,
      draft.startOffsetUnit,
    );
    if (mode === 'open') {
      return t(hasContents ? 'anchor_sentence_open' : 'anchor_sentence_instant', { from });
    }
    if (!draft.endSceneId) return t('anchor_sentence_need_end', { from });
    return t('anchor_sentence', {
      from,
      to: describePoint(draft.endSceneId, draft.endPosition, draft.endOffset, draft.endOffsetUnit),
    });
  })();

  const styles = StyleSheet.create({
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 24,
      // ResponsiveModal clips rounded surfaces; focus borders on inputs need to paint into padding.
      overflow: 'visible',
    },
    keyboardContent: {
      paddingBottom: 12,
      paddingHorizontal: 2,
      paddingVertical: 2,
    },
    handle: {
      alignSelf: 'center',
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 14,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    preview: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
      marginBottom: 16,
      textAlign: 'center',
    },
    modes: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      overflow: 'hidden',
      marginBottom: 18,
    },
    mode: {
      flexGrow: 1,
      flexShrink: 1,
      paddingVertical: 10,
      paddingHorizontal: 8,
      alignItems: 'center',
    },
    modeText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
    formGroup: {
      marginBottom: 16,
      paddingHorizontal: 2,
      paddingVertical: 2,
    },
    timingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 8,
    },
    numberWidthInput: { width: '30%' },
    unitField: { flex: 1 },
    label: { fontSize: 16, color: colors.text, marginBottom: 6 },
    positions: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      overflow: 'hidden',
      marginTop: 8,
    },
    position: { flexGrow: 1, flexShrink: 1, paddingVertical: 10, alignItems: 'center' },
    positionText: { fontSize: 13, fontWeight: '700' },
    distanceToggle: { marginTop: 10, paddingVertical: 6 },
    distanceToggleText: { fontSize: 13, fontWeight: '700', color: colors.primary },
    distanceBlock: { marginTop: 8, gap: 8 },
    directionRow: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      overflow: 'hidden',
    },
    hint: { fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 17 },
    buttons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 16,
      paddingHorizontal: '3%',
    },
    buttonWrapper: { width: '47%' },
  });

  const patch = (changes: Partial<AnchorDraft>) =>
    setDraft((current) => ({ ...current, ...changes }));

  const signed = (text: string, negative: boolean) => {
    const magnitude = Number(text);
    if (!text || Number.isNaN(magnitude) || magnitude === 0) return null;
    return negative ? -Math.abs(magnitude) : Math.abs(magnitude);
  };

  const setModeTo = (next: AnchorMode) => {
    if (next === 'open' && !allowOpenStretch) return;
    setMode(next);
    if (next === 'open') {
      patch({
        endSceneId: null,
        endPosition: null,
        endOffset: null,
        endOffsetUnit: null,
      });
      setEndAmount('');
      setShowEndDistance(false);
      return;
    }
    if (!draft.endSceneId) {
      patch({
        endSceneId: draft.startSceneId,
        endPosition: 'end',
      });
    }
  };

  const renderDistance = (edge: 'start' | 'end') => {
    const unit = edge === 'start' ? draft.startOffsetUnit : draft.endOffsetUnit;
    const offset = edge === 'start' ? draft.startOffset : draft.endOffset;
    const amount = edge === 'start' ? startAmount : endAmount;
    const setAmount = edge === 'start' ? setStartAmount : setEndAmount;
    const before = (offset ?? 0) < 0;
    const shown = edge === 'start' ? showStartDistance : showEndDistance;
    const setShown = edge === 'start' ? setShowStartDistance : setShowEndDistance;

    return (
      <>
        <TouchableOpacity
          style={styles.distanceToggle}
          onPress={() => setShown((value) => !value)}
          accessibilityRole="button"
        >
          <Text style={styles.distanceToggleText}>
            {shown ? t('anchor_hide_distance') : t('anchor_show_distance')}
          </Text>
        </TouchableOpacity>
        {shown && (
          <View style={styles.distanceBlock}>
            <View style={styles.timingRow}>
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
                style={[commonInputStyles.input, styles.numberWidthInput]}
              />
              <View style={styles.unitField}>
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
            </View>
            <View style={styles.directionRow}>
              {([true, false] as const).map((negative) => {
                const selected = before === negative;
                return (
                  <TouchableOpacity
                    key={String(negative)}
                    style={[
                      styles.position,
                      selected && { backgroundColor: colors.primaryContainer },
                    ]}
                    onPress={() => {
                      const value = signed(amount, negative);
                      patch(edge === 'start' ? { startOffset: value } : { endOffset: value });
                    }}
                  >
                    <Text
                      style={[
                        styles.positionText,
                        { color: selected ? colors.onPrimaryContainer : colors.textSecondary },
                      ]}
                    >
                      {t(negative ? 'anchor_direction_before' : 'anchor_direction_after')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.hint}>{t('anchor_offset_hint')}</Text>
          </View>
        )}
      </>
    );
  };

  const renderPoint = (edge: 'start' | 'end') => {
    const sceneId = edge === 'start' ? draft.startSceneId : draft.endSceneId;
    const position = edge === 'start' ? draft.startPosition : (draft.endPosition ?? 'end');

    return (
      <View style={styles.formGroup}>
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
        {renderDistance(edge)}
      </View>
    );
  };

  const complete = Boolean(draft.startSceneId) && (mode === 'open' || Boolean(draft.endSceneId));

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onCancel}
      placement="adaptive"
      contentStyle={styles.sheet}
      maxHeight="86%"
      keyboardAvoiding={false}
    >
      <KeyboardAwareScreen
        contentContainerStyle={styles.keyboardContent}
        keyboardVerticalOffset={0}
      >
        {isCompact && <View style={styles.handle} />}
        <Text style={styles.title}>{t('anchor_modal_title')}</Text>
        <Text style={styles.preview}>{preview}</Text>
        <View style={styles.modes}>
          {(['open', 'closed'] as const).map((option) => {
            const selected = mode === option;
            const disabled = option === 'open' && !allowOpenStretch;
            return (
              <TouchableOpacity
                key={option}
                disabled={disabled}
                onPress={() => setModeTo(option)}
                style={[
                  styles.mode,
                  selected && { backgroundColor: colors.primaryContainer },
                  disabled && { opacity: 0.45 },
                ]}
              >
                <Text
                  style={[
                    styles.modeText,
                    { color: selected ? colors.onPrimaryContainer : colors.textSecondary },
                  ]}
                >
                  {t(option === 'open' ? 'anchor_mode_open' : 'anchor_mode_closed')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {mode === 'open' && (
          <Text style={[styles.hint, { marginBottom: 12 }]}>
            {hasContents ? t('anchor_mode_open_hint') : t('anchor_mode_open_empty_hint')}
          </Text>
        )}
        {renderPoint('start')}
        {mode === 'closed' && renderPoint('end')}
        <View style={styles.buttons}>
          <View style={styles.buttonWrapper}>
            <Button onPress={onCancel}>{t('cancel')}</Button>
          </View>
          <View style={styles.buttonWrapper}>
            <Button
              onPress={() =>
                onConfirm(
                  mode === 'open'
                    ? {
                        ...draft,
                        endSceneId: null,
                        endPosition: null,
                        endOffset: null,
                        endOffsetUnit: null,
                      }
                    : draft,
                )
              }
              disabled={!complete}
              testID="confirm-anchor"
            >
              {t('save')}
            </Button>
          </View>
        </View>
      </KeyboardAwareScreen>
    </ResponsiveModal>
  );
};

export default AnchorEditModal;
