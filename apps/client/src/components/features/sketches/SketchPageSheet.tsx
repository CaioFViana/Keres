import {
  SKETCH_PAGE_BACKGROUNDS,
  SKETCH_PAGE_PRESETS,
  type SketchPageBackground,
  type SketchPageType,
} from '@keres/shared';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useTheme } from '../../../theme';
import { getCommonChipStyles } from '../../../theme/commonStyles';
import { space, type } from '../../../theme/tokens';

interface SketchPageSheetProps {
  page: SketchPageType;
  onApply: (page: {
    width: number;
    height: number;
    preset: string | null;
    background: SketchPageBackground;
  }) => void;
  onClose: () => void;
}

/**
 * Paper size for the sketch: presets plus a custom size, in world units. Orientation is
 * just a swap - portrait and landscape are the same paper turned. The size bounds the
 * export, and the canvas frames it on open; drawing outside stays allowed.
 */
const SketchPageSheet: React.FC<SketchPageSheetProps> = ({ page, onApply, onClose }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [widthText, setWidthText] = useState(String(Math.round(page.width)));
  const [heightText, setHeightText] = useState(String(Math.round(page.height)));
  const width = Math.max(96, Math.min(8000, Math.round(Number(widthText) || 0)));
  const height = Math.max(96, Math.min(8000, Math.round(Number(heightText) || 0)));
  const [background, setBackground] = useState<SketchPageBackground>(page.background);
  const landscape = width >= height;
  const styles = StyleSheet.create({
    title: { ...type.title, color: colors.text, marginBottom: space.lg },
    label: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 12, marginBottom: 6 },
    row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    ...getCommonChipStyles(colors),
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
      borderRadius: 8,
      padding: 10,
      flex: 1,
    },
    note: { color: colors.textSecondary, fontSize: 12, marginTop: 10 },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 18 },
  });
  const apply = (nextWidth: number, nextHeight: number, preset: string | null) => {
    onApply({ width: nextWidth, height: nextHeight, preset, background });
    onClose();
  };
  return (
    <ResponsiveModal visible onClose={onClose} placement="adaptive" tone="raised" inset="sheet">
      <Text style={styles.title}>{t('sketch_page_title')}</Text>
      <Text style={styles.label}>{t('sketch_page_presets')}</Text>
      <View style={styles.row}>
        {SKETCH_PAGE_PRESETS.map((preset) => {
          const active = page.preset === preset.id;
          return (
            <TouchableOpacity
              key={preset.id}
              onPress={() => apply(preset.width, preset.height, preset.id)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t(`sketch_page_preset_${preset.id}`)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {t(`sketch_page_preset_${preset.id}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.label}>{t('sketch_page_custom')}</Text>
      <View style={styles.row}>
        <TextInput
          value={widthText}
          onChangeText={setWidthText}
          keyboardType="numeric"
          accessibilityLabel={t('sketch_page_width')}
          style={styles.input}
        />
        <TextInput
          value={heightText}
          onChangeText={setHeightText}
          keyboardType="numeric"
          accessibilityLabel={t('sketch_page_height')}
          style={styles.input}
        />
      </View>
      <Text style={styles.label}>{t('sketch_page_orientation')}</Text>
      <View style={styles.row}>
        <TouchableOpacity
          onPress={() => {
            setWidthText(String(Math.min(width, height)));
            setHeightText(String(Math.max(width, height)));
          }}
          style={[styles.chip, !landscape && styles.chipActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: !landscape }}
          accessibilityLabel={t('sketch_page_portrait')}
        >
          <Text style={[styles.chipText, !landscape && styles.chipTextActive]}>
            {t('sketch_page_portrait')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            setWidthText(String(Math.max(width, height)));
            setHeightText(String(Math.min(width, height)));
          }}
          style={[styles.chip, landscape && styles.chipActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: landscape }}
          accessibilityLabel={t('sketch_page_landscape')}
        >
          <Text style={[styles.chipText, landscape && styles.chipTextActive]}>
            {t('sketch_page_landscape')}
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.label}>{t('sketch_page_background')}</Text>
      <View style={styles.row}>
        {SKETCH_PAGE_BACKGROUNDS.map((option) => {
          const active = background === option;
          return (
            <TouchableOpacity
              key={option}
              onPress={() => setBackground(option)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t(`sketch_page_background_${option}`)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {t(`sketch_page_background_${option}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.note}>{t('sketch_page_resize_note')}</Text>
      <View style={styles.actions}>
        <Button onPress={onClose}>{t('cancel')}</Button>
        <Button onPress={() => apply(width, height, null)}>{t('apply')}</Button>
      </View>
    </ResponsiveModal>
  );
};

export default SketchPageSheet;
