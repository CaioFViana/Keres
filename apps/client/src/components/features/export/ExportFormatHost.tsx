import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ModalHeader from '@/src/components/layout/ModalHeader/ModalHeader';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useExportFormatPromptStore } from '../../../state/exportFormatPromptStore';
import { useTheme } from '../../../theme';

/**
 * The export chooser every canvas shares: an .svg (the vector drawing, to continue elsewhere) or a
 * .png (the picture, to share or print). Mounted once near the app root; screens reach it through
 * `chooseExportFormat()`. Closing it cancels the export.
 */
const ExportFormatHost: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const open = useExportFormatPromptStore((state) => state.open);
  const answer = useExportFormatPromptStore((state) => state.answer);
  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowText: { color: colors.text, fontSize: 15, fontWeight: '600' },
    rowSub: { color: colors.textSecondary, fontSize: 12 },
  });
  if (!open) return null;
  const options = [
    {
      format: 'svg' as const,
      icon: 'document-outline' as const,
      title: t('export_choose_svg'),
      sub: t('export_choose_svg_sub'),
    },
    {
      format: 'png' as const,
      icon: 'image-outline' as const,
      title: t('export_choose_png'),
      sub: t('export_choose_png_sub'),
    },
  ];
  return (
    <ResponsiveModal
      visible
      onClose={() => answer(null)}
      placement="adaptive"
      tone="raised"
      inset="sheet"
    >
      <ModalHeader title={t('export_choose_title')} onClose={() => answer(null)} />
      {options.map(({ format, icon, title, sub }) => (
        <TouchableOpacity
          key={format}
          testID={`export-format-${format}`}
          onPress={() => answer(format)}
          style={styles.row}
          accessibilityRole="button"
          accessibilityLabel={title}
        >
          <Ionicons name={icon} size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowText}>{title}</Text>
            <Text style={styles.rowSub}>{sub}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ResponsiveModal>
  );
};

export default ExportFormatHost;
