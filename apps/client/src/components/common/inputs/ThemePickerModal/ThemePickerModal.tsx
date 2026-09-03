import Button from '@/src/components/common/controls/Button/Button';
import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { themeDisplayOptions, themes } from '@keres/shared';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/src/theme';

interface ThemePickerModalProps {
  visible: boolean;
  /** The persisted choice to restore when the picker is cancelled. */
  value: string | null;
  onPreview: (themeName: string) => void;
  onConfirm: (themeName: string) => void;
  onClose: () => void;
  saving?: boolean;
}

/**
 * A reusable theme chooser with a temporary, reversible preview.
 *
 * It intentionally does not persist anything: a Story can save its default now and an Arc can
 * later save an override through the same picker. Closing always returns the app to `value`.
 */
const ThemePickerModal: React.FC<ThemePickerModalProps> = ({
  visible,
  value,
  onPreview,
  onConfirm,
  onClose,
  saving = false,
}) => {
  const { t } = useTranslation();
  const { colors, isDarkMode } = useTheme();
  const savedThemeName = value || 'default';
  const [draftThemeName, setDraftThemeName] = useState(savedThemeName);

  useEffect(() => {
    if (visible) {
      setDraftThemeName(savedThemeName);
    }
  }, [savedThemeName, visible]);

  const handleClose = () => {
    onPreview(savedThemeName);
    onClose();
  };

  const handleSelect = (themeName: string) => {
    setDraftThemeName(themeName);
    onPreview(themeName);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: { padding: 20 },
        title: { color: colors.text, fontSize: 20, fontWeight: '700' },
        description: { color: colors.textSecondary, lineHeight: 19, marginTop: 6 },
        list: { marginTop: 16, maxHeight: 460 },
        option: {
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: 8,
          borderWidth: 1,
          flexDirection: 'row',
          gap: 12,
          marginBottom: 8,
          minHeight: 54,
          paddingHorizontal: 12,
          paddingVertical: 9,
        },
        optionSelected: { borderColor: colors.primary, borderWidth: 2 },
        swatch: { borderRadius: 16, height: 32, width: 32 },
        optionLabel: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '600' },
        selectedText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
        cancelButton: { backgroundColor: colors.textSecondary },
      }),
    [colors],
  );

  return (
    <ResponsiveModal visible={visible} onClose={handleClose} maxHeight="90%" placement="adaptive">
      <View style={styles.content}>
        <Text style={styles.title}>{t('select_theme')}</Text>
        <Text style={styles.description}>{t('theme_picker_description')}</Text>
        <ScrollView style={styles.list} showsVerticalScrollIndicator>
          {themeDisplayOptions.map((option) => {
            const palette = themes[option.value];
            const paletteColors = isDarkMode ? palette.darkColors : palette.lightColors;
            const selected = option.value === draftThemeName;

            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => handleSelect(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View style={[styles.swatch, { backgroundColor: paletteColors.primary }]} />
                <Text style={styles.optionLabel}>{t(option.labelKey)}</Text>
                {selected ? <Text style={styles.selectedText}>{t('theme_picker_selected')}</Text> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <FormActions stackOnCompact>
          <Button onPress={handleClose} style={styles.cancelButton} disabled={saving}>
            {t('cancel')}
          </Button>
          <Button onPress={() => onConfirm(draftThemeName)} disabled={saving}>
            {t('save')}
          </Button>
        </FormActions>
      </View>
    </ResponsiveModal>
  );
};

export default ThemePickerModal;
