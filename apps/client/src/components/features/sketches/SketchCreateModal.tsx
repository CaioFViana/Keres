import {
  MAX_SKETCH_DESCRIPTION_LENGTH,
  MAX_SKETCH_TITLE_LENGTH,
  SKETCH_PAGE_PRESETS,
  type SketchPagePresetId,
} from '@keres/shared';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { getCommonChipStyles, getCommonInputStyles } from '@/src/theme/commonStyles';
import { type ThemeColors, useTheme } from '../../../theme';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { space, typography } from '../../../theme/tokens';

interface Props {
  visible: boolean;
  initialValues?: { name: string; description: string | null };
  title?: string;
  confirmLabel?: string;
  onCancel: () => void;
  /** Offer the paper choice (new sketches only; an existing sketch resizes from the canvas). */
  pickPage?: boolean;
  onConfirm: (name: string, description: string | null, pagePreset: SketchPagePresetId) => void;
}

/** Name + optional description for a new sketch, mirroring the board create modal. */
const SketchCreateModal: React.FC<Props> = ({
  visible,
  initialValues,
  title,
  confirmLabel,
  pickPage = false,
  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  // Only the two fields are used, and `initialValues` is a fresh object per render of
  // the parent. Resetting the editors when the modal opens keeps typing intact while it
  // stays open.
  const initialName = initialValues?.name ?? '';
  const initialDescription = initialValues?.description ?? '';
  const [prevVisible, setPrevVisible] = useState<boolean | null>(null);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [pagePreset, setPagePreset] = useState<SketchPagePresetId>('a4');
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setName(initialName);
      setDescription(initialDescription);
    }
  }
  const styles = useThemedStyles(createStyles);
  return (
    <ResponsiveModal
      visible={visible}
      onClose={onCancel}
      placement="adaptive"
      tone="raised"
      inset="sheet"
    >
      <Text style={styles.title}>{title ?? t('sketch_create_title')}</Text>
      <Text style={styles.label}>{t('sketch_name')}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={t('sketch_name_placeholder')}
        maxLength={MAX_SKETCH_TITLE_LENGTH}
      />
      <Text style={styles.label}>{t('sketch_description')}</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder={t('sketch_description_placeholder')}
        maxLength={MAX_SKETCH_DESCRIPTION_LENGTH}
        multiline
        numberOfLines={5}
        style={getCommonInputStyles(colors).multiline}
      />
      {pickPage && (
        <>
          <Text style={styles.label}>{t('sketch_page_presets')}</Text>
          <View style={styles.presets}>
            {SKETCH_PAGE_PRESETS.map((preset) => {
              const active = pagePreset === preset.id;
              return (
                <TouchableOpacity
                  key={preset.id}
                  onPress={() => setPagePreset(preset.id)}
                  style={[styles.chip, active && styles.chipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {t(`sketch_page_preset_${preset.id}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
      <View style={styles.actions}>
        <Button onPress={onCancel}>{t('cancel')}</Button>
        <Button
          onPress={() => onConfirm(name.trim(), description.trim() || null, pagePreset)}
          disabled={!name.trim()}
        >
          {confirmLabel ?? t('add')}
        </Button>
      </View>
    </ResponsiveModal>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    title: { ...typography.title, color: colors.text, marginBottom: space.lg },
    label: { ...typography.sectionTitle, color: colors.text, marginBottom: 5 },
    presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    ...getCommonChipStyles(colors),
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
      marginTop: 18,
    },
  });

export default SketchCreateModal;
