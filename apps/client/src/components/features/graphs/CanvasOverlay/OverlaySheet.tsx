import { Ionicons } from '@expo/vector-icons';
import {
  CANVAS_OVERLAY_FONT_SIZES,
  MAP_ICON_OPTIONS,
  MAX_CANVAS_OVERLAY_LABEL_LENGTH,
  MAX_CANVAS_OVERLAY_TEXT_LENGTH,
  type CanvasOverlayType,
} from '@keres/shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import FormSwitchField from '@/src/components/common/forms/FormSwitchField/FormSwitchField';
import ColorPickerInput from '@/src/components/common/inputs/ColorPickerInput/ColorPickerInput';
import IconPickerInput from '@/src/components/common/inputs/IconPickerInput/IconPickerInput';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useTheme } from '../../../../theme';

interface OverlaySheetProps {
  overlay: CanvasOverlayType;
  canEdit: boolean;
  /** Shown in the color picker while the overlay sets no color of its own. */
  defaultColor: string;
  onChange: (patch: {
    label?: string | null;
    color?: string | null;
    icon?: string;
    dashed?: boolean;
    filled?: boolean;
    content?: string;
    fontSize?: number;
    align?: 'left' | 'center';
    width?: number;
  }) => void;
  onRemove: () => void;
  onClose: () => void;
}

/** Label/color/delete editor for one canvas overlay, shared by boards and maps. */
const OverlaySheet: React.FC<OverlaySheetProps> = ({
  overlay,
  canEdit,
  defaultColor,
  onChange,
  onRemove,
  onClose,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: '78%',
    },
    scroll: { flexShrink: 1 },
    scrollContent: { paddingHorizontal: 22, paddingTop: 2, paddingBottom: 24 },
    title: { color: colors.text, fontSize: 19, fontWeight: 'bold', flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 16,
    },
    label: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 14, marginBottom: 6 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
      borderRadius: 8,
      padding: 10,
    },
    multiline: { minHeight: 88, textAlignVertical: 'top' },
    row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { color: colors.text, fontSize: 14, fontWeight: '600' },
    chipTextActive: { color: colors.onPrimary },
    remove: { backgroundColor: colors.error, marginTop: 20 },
  });
  return (
    <ResponsiveModal visible onClose={onClose} placement="adaptive" contentStyle={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>{t(`overlay_kind_${overlay.kind}`)}</Text>
        <TouchableOpacity onPress={onClose} accessibilityLabel={t('close')}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <ScrollView
        testID="overlay-sheet-scroll"
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {overlay.kind === 'text' ? (
          <>
            <Text style={styles.label}>{t('overlay_sheet_text')}</Text>
            <TextInput
              value={overlay.content}
              editable={canEdit}
              onChangeText={(value) => onChange({ content: value })}
              placeholder={t('overlay_sheet_text_placeholder')}
              placeholderTextColor={colors.textSecondary}
              maxLength={MAX_CANVAS_OVERLAY_TEXT_LENGTH}
              multiline
              style={[styles.input, styles.multiline]}
            />
          </>
        ) : (
          <>
            <Text style={styles.label}>{t('overlay_sheet_label')}</Text>
            <TextInput
              value={overlay.label ?? ''}
              editable={canEdit}
              onChangeText={(value) => onChange({ label: value || null })}
              placeholder={t('overlay_sheet_label_placeholder')}
              placeholderTextColor={colors.textSecondary}
              maxLength={MAX_CANVAS_OVERLAY_LABEL_LENGTH}
              style={styles.input}
            />
          </>
        )}
        {canEdit && (
          <>
            {overlay.kind === 'stamp' && (
              <>
                <Text style={styles.label}>{t('overlay_sheet_icon')}</Text>
                <IconPickerInput
                  currentIcon={overlay.icon}
                  onSelectIcon={(icon) => onChange({ icon })}
                  iconOptions={MAP_ICON_OPTIONS as readonly (keyof typeof Ionicons.glyphMap)[]}
                  placeholder={t('overlay_sheet_icon')}
                />
              </>
            )}
            <Text style={styles.label}>{t('overlay_sheet_color')}</Text>
            <ColorPickerInput
              currentColor={overlay.color ?? defaultColor}
              onSelectColor={(value) => onChange({ color: value })}
              placeholder={t('overlay_sheet_color')}
            />
            {(overlay.kind === 'polygon' ||
              overlay.kind === 'frame' ||
              overlay.kind === 'shape') && (
              <FormSwitchField
                label={t('overlay_sheet_filled')}
                value={overlay.filled ?? false}
                onValueChange={(value) => onChange({ filled: value })}
              />
            )}
            {overlay.kind === 'text' && (
              <>
                <Text style={styles.label}>{t('overlay_sheet_font_size')}</Text>
                <View style={styles.row}>
                  {CANVAS_OVERLAY_FONT_SIZES.map((size) => {
                    const active = (overlay.fontSize ?? 18) === size;
                    return (
                      <TouchableOpacity
                        key={size}
                        onPress={() => onChange({ fontSize: size })}
                        style={[styles.chip, active && styles.chipActive]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`${size}`}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {size}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.label}>{t('overlay_sheet_align')}</Text>
                <View style={styles.row}>
                  {(['left', 'center'] as const).map((align) => {
                    const active = (overlay.align ?? 'left') === align;
                    return (
                      <TouchableOpacity
                        key={align}
                        onPress={() => onChange({ align })}
                        style={[styles.chip, active && styles.chipActive]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={t(`overlay_sheet_align_${align}`)}
                      >
                        <Ionicons
                          name={align === 'left' ? 'text-outline' : 'text'}
                          size={18}
                          color={active ? colors.onPrimary : colors.text}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.label}>{t('overlay_sheet_width')}</Text>
                <View style={styles.row}>
                  <TouchableOpacity
                    onPress={() =>
                      onChange({ width: Math.max(24, overlay.width - 40) })
                    }
                    style={styles.chip}
                    accessibilityRole="button"
                    accessibilityLabel={t('overlay_sheet_width_smaller')}
                  >
                    <Ionicons name="remove" size={18} color={colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => onChange({ width: overlay.width + 40 })}
                    style={styles.chip}
                    accessibilityRole="button"
                    accessibilityLabel={t('overlay_sheet_width_larger')}
                  >
                    <Ionicons name="add" size={18} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </>
            )}
            {overlay.kind !== 'stamp' && overlay.kind !== 'text' && (
              <FormSwitchField
                label={t('overlay_sheet_dashed')}
                value={
                  overlay.kind === 'frame' ? (overlay.dashed ?? true) : (overlay.dashed ?? false)
                }
                onValueChange={(value) => onChange({ dashed: value })}
              />
            )}
            <Button onPress={onRemove} style={styles.remove}>
              {t('overlay_sheet_remove')}
            </Button>
          </>
        )}
      </ScrollView>
    </ResponsiveModal>
  );
};

export default OverlaySheet;
