import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useTheme } from '../../../theme';
import { space, type } from '../../../theme/tokens';

interface SketchExportSheetProps {
  hasCover: boolean;
  busy: boolean;
  onExportSvg: () => void;
  onExportPng: () => void;
  onSaveToGallery: () => void;
  onClose: () => void;
}

/**
 * Export destinations for a sketch: an .svg file (the vector drawing), a .png file
 * (the page rasterized), or a .png saved into the story gallery as the sketch's cover -
 * which is what shows as the sketch's image outside the canvas.
 */
const SketchExportSheet: React.FC<SketchExportSheetProps> = ({
  hasCover,
  busy,
  onExportSvg,
  onExportPng,
  onSaveToGallery,
  onClose,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: space.md },
    title: { ...type.title, color: colors.text, flex: 1 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowText: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
    rowSub: { color: colors.textSecondary, fontSize: 12 },
  });
  const options = [
    {
      icon: 'document-outline' as const,
      title: t('sketch_export_svg'),
      sub: t('sketch_export_svg_sub'),
      onPress: onExportSvg,
    },
    {
      icon: 'image-outline' as const,
      title: t('sketch_export_png'),
      sub: t('sketch_export_png_sub'),
      onPress: onExportPng,
    },
    {
      icon: 'images-outline' as const,
      title: hasCover ? t('sketch_export_gallery_update') : t('sketch_export_gallery'),
      sub: t('sketch_export_gallery_sub'),
      onPress: onSaveToGallery,
    },
  ];
  return (
    <ResponsiveModal visible onClose={onClose} placement="adaptive" tone="raised" inset="sheet">
      <View style={styles.header}>
        <Text style={styles.title}>{t('sketch_export_title')}</Text>
        <TouchableOpacity onPress={onClose} accessibilityLabel={t('close')} disabled={busy}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      {options.map(({ icon, title, sub, onPress }) => (
        <TouchableOpacity
          key={title}
          onPress={onPress}
          disabled={busy}
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

export default SketchExportSheet;
