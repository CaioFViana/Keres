import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import {
  CANVAS_ACTION_ROW_HEIGHT,
  CanvasActionBarButton,
} from '@/src/components/features/graphs/CanvasActionBar/CanvasActionBar';
import { useResponsiveLayout } from '../../../../hooks/useResponsiveLayout';
import { useTheme } from '../../../../theme';
import type { OverlayDrawTool } from './overlayTools';

interface OverlayDrawBarProps {
  tool: OverlayDrawTool;
  canFinish: boolean;
  onFinish: () => void;
  onCancel: () => void;
}

const HINT_KEYS: Record<OverlayDrawTool, string> = {
  line: 'overlay_draw_line_hint',
  polygon: 'overlay_draw_polygon_hint',
  frame: 'overlay_draw_rect_hint',
  rect: 'overlay_draw_rect_hint',
  ellipse: 'overlay_draw_rect_hint',
  stamp: 'overlay_draw_stamp_hint',
  'preset:star': 'overlay_draw_rect_hint',
  'preset:diamond': 'overlay_draw_rect_hint',
  'preset:square': 'overlay_draw_rect_hint',
  'preset:triangle': 'overlay_draw_rect_hint',
  'preset:pentagon': 'overlay_draw_rect_hint',
  'preset:hexagon': 'overlay_draw_rect_hint',
};

/**
 * Replaces the canvas tools while a drawing tool is armed: the gesture hint plus
 * finish/cancel. Same metrics as the tools bar, so arming a tool never pops the
 * canvas below: one row on medium and wide screens, and the compact two-row shape
 * (actions, then the hint on its own line) on small ones. Rect and stamp tools
 * commit on the gesture, so their bar only ever cancels.
 */
const OverlayDrawBar: React.FC<OverlayDrawBarProps> = ({ tool, canFinish, onFinish, onCancel }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { isCompact } = useResponsiveLayout();
  const styles = StyleSheet.create({
    bar: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    compactRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    rowDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: 8,
    },
    hint: { flex: 1, color: colors.textSecondary },
    compactHintRow: { minHeight: CANVAS_ACTION_ROW_HEIGHT, justifyContent: 'center' },
    compactHint: { color: colors.textSecondary },
  });
  const showFinish = tool === 'line' || tool === 'polygon';
  const cancel = (
    <CanvasActionBarButton
      testID="overlay-draw-cancel"
      icon="close-outline"
      label={t('overlay_draw_cancel')}
      onPress={onCancel}
    />
  );
  const finish = showFinish ? (
    <CanvasActionBarButton
      testID="overlay-draw-finish"
      icon="checkmark-outline"
      label={t('overlay_draw_finish')}
      onPress={onFinish}
      disabled={!canFinish}
    />
  ) : null;
  if (isCompact) {
    return (
      <View style={styles.bar}>
        <View style={styles.compactRow}>
          {cancel}
          {finish}
        </View>
        <View style={styles.rowDivider} />
        <View style={styles.compactHintRow}>
          <Text style={styles.compactHint} numberOfLines={1}>
            {t(HINT_KEYS[tool])}
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.bar}>
      <View style={styles.row}>
        {cancel}
        <Text style={styles.hint} numberOfLines={1}>
          {t(HINT_KEYS[tool])}
        </Text>
        {finish}
      </View>
    </View>
  );
};

export default OverlayDrawBar;
