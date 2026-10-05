import { CANVAS_OVERLAY_PRESETS } from '@keres/shared/graphs/canvasOverlayGeometry';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import type { AddObjectsAction } from '../graphs/CanvasOverlay/overlayTools';
import { useTheme } from '../../../theme';

interface SketchPresetPickerProps {
  onPick: (tool: AddObjectsAction) => void;
  onClose: () => void;
}

const PRESET_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  triangle: 'triangle-outline',
  square: 'square-outline',
  diamond: 'diamond-outline',
  pentagon: 'shapes-outline',
  hexagon: 'shapes-outline',
  star: 'star-outline',
  'speech-oval': 'chatbubble-ellipses-outline',
  'speech-rect': 'chatbubble-outline',
};

/**
 * Shape presets behind the "shapes" toolbar button: the ellipse plus every polygon
 * preset, speech balloons included. Picking arms the drag tool; the balloon's tail tip
 * (last vertex) is then pulled toward the speaker in select mode.
 */
const SketchPresetPicker: React.FC<SketchPresetPickerProps> = ({ onPick, onClose }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
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
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    cell: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    cellText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  });
  const options: { tool: AddObjectsAction; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { tool: 'draw:ellipse', label: t('sketch_tool_ellipse'), icon: 'ellipse-outline' },
    ...CANVAS_OVERLAY_PRESETS.map((preset) => ({
      tool: `preset:${preset}` as AddObjectsAction,
      label: t(
        preset === 'speech-oval'
          ? 'sketch_preset_speech_oval'
          : preset === 'speech-rect'
            ? 'sketch_preset_speech_rect'
            : `objects_preset_${preset}`,
      ),
      icon: PRESET_ICONS[preset] ?? 'shapes-outline',
    })),
  ];
  return (
    <ResponsiveModal visible onClose={onClose} placement="adaptive" contentStyle={styles.sheet}>
      <Text style={styles.title}>{t('sketch_preset_title')}</Text>
      <View style={styles.grid}>
        {options.map(({ tool, label, icon }) => (
          <TouchableOpacity
            key={tool}
            onPress={() => {
              onPick(tool);
              onClose();
            }}
            style={styles.cell}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            <Ionicons name={icon} size={20} color={colors.text} />
            <Text style={styles.cellText}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ResponsiveModal>
  );
};

export default SketchPresetPicker;
