import { Ionicons } from '@expo/vector-icons';
import type { CanvasOverlayType } from '@keres/shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import ColorPickerInput from '@/src/components/common/inputs/ColorPickerInput/ColorPickerInput';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useTheme } from '../../../../theme';

interface OverlaySheetProps {
  overlay: CanvasOverlayType;
  canEdit: boolean;
  /** Shown in the color picker while the overlay sets no color of its own. */
  defaultColor: string;
  onChange: (patch: { label?: string | null; color?: string | null }) => void;
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
        <Text style={styles.label}>{t('overlay_sheet_label')}</Text>
        <TextInput
          value={overlay.label ?? ''}
          editable={canEdit}
          onChangeText={(value) => onChange({ label: value || null })}
          placeholder={t('overlay_sheet_label_placeholder')}
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />
        {canEdit && (
          <>
            <Text style={styles.label}>{t('overlay_sheet_color')}</Text>
            <ColorPickerInput
              currentColor={overlay.color ?? defaultColor}
              onSelectColor={(value) => onChange({ color: value })}
              placeholder={t('overlay_sheet_color')}
            />
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
