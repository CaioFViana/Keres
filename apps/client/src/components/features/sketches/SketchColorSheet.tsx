import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ColorPickerModal from '@/src/components/common/inputs/ColorPickerInput/ColorPickerModal';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { SKETCH_PALETTE } from '../../../state/sketchToolStore';
import { useTheme } from '../../../theme';

interface SketchColorSheetProps {
  color: string;
  recentColors: readonly string[];
  onPick: (color: string) => void;
  onClose: () => void;
}

/** Palette, recent colors and the full picker; picking closes the sheet. */
const SketchColorSheet: React.FC<SketchColorSheetProps> = ({
  color,
  recentColors,
  onPick,
  onClose,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [custom, setCustom] = useState(false);
  const styles = StyleSheet.create({
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 24,
    },
    title: { color: colors.text, fontSize: 19, fontWeight: 'bold', marginBottom: 12 },
    label: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 12,
      marginBottom: 8,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    swatch: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selected: { borderWidth: 3, borderColor: colors.primary },
    custom: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
    customText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  });
  const swatch = (value: string) => (
    <TouchableOpacity
      key={value}
      accessibilityRole="button"
      accessibilityLabel={value}
      accessibilityState={{ selected: value.toLowerCase() === color.toLowerCase() }}
      onPress={() => {
        onPick(value);
        onClose();
      }}
      style={[
        styles.swatch,
        { backgroundColor: value },
        value.toLowerCase() === color.toLowerCase() && styles.selected,
      ]}
    />
  );
  if (custom) {
    return (
      <ColorPickerModal
        currentColor={color}
        title={t('sketch_color_custom')}
        onSelectColor={(picked) => {
          onPick(picked);
          onClose();
        }}
        onClose={() => setCustom(false)}
      />
    );
  }
  return (
    <ResponsiveModal visible onClose={onClose} placement="adaptive" contentStyle={styles.sheet}>
      <Text style={styles.title}>{t('sketch_color_title')}</Text>
      <View style={styles.grid}>{SKETCH_PALETTE.map(swatch)}</View>
      {recentColors.length > 0 && (
        <>
          <Text style={styles.label}>{t('sketch_color_recent')}</Text>
          <View style={styles.grid}>{recentColors.map(swatch)}</View>
        </>
      )}
      <TouchableOpacity
        style={styles.custom}
        onPress={() => setCustom(true)}
        accessibilityRole="button"
      >
        <Ionicons name="color-palette-outline" size={22} color={colors.primary} />
        <Text style={styles.customText}>{t('sketch_color_custom')}</Text>
      </TouchableOpacity>
    </ResponsiveModal>
  );
};

export default SketchColorSheet;
