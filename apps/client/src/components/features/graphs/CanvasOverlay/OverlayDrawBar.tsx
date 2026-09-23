import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import { useTheme } from '../../../../theme';
import { isRectDrawTool, type OverlayDrawTool } from './overlayTools';

interface OverlayDrawBarProps {
  tool: OverlayDrawTool;
  canFinish: boolean;
  onFinish: () => void;
  onCancel: () => void;
}

/**
 * Replaces the canvas tools while a drawing tool is armed: the gesture hint plus
 * finish/cancel. Rect tools commit on release, so their bar only ever cancels.
 */
const OverlayDrawBar: React.FC<OverlayDrawBarProps> = ({ tool, canFinish, onFinish, onCancel }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    bar: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    hint: { color: colors.textSecondary, marginBottom: 8 },
    row: { flexDirection: 'row', gap: 8 },
    control: { flex: 1 },
  });
  const hint = isRectDrawTool(tool)
    ? t('overlay_draw_rect_hint')
    : t(tool === 'line' ? 'overlay_draw_line_hint' : 'overlay_draw_polygon_hint');
  return (
    <View style={styles.bar}>
      <Text style={styles.hint}>{hint}</Text>
      <View style={styles.row}>
        <View style={styles.control}>
          <Button onPress={onCancel} style={{ height: 50 }}>
            {t('overlay_draw_cancel')}
          </Button>
        </View>
        {!isRectDrawTool(tool) && (
          <View style={styles.control}>
            <Button onPress={onFinish} disabled={!canFinish} style={{ height: 50 }}>
              {t('overlay_draw_finish')}
            </Button>
          </View>
        )}
      </View>
    </View>
  );
};

export default OverlayDrawBar;
