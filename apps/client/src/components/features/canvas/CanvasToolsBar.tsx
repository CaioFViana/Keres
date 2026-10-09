import React from 'react';
import { StyleSheet, View } from 'react-native';
import OverlayDrawBar from '@/src/components/features/graphs/CanvasOverlay/OverlayDrawBar';
import type { OverlayDrawTool } from '@/src/components/features/graphs/CanvasOverlay/overlayTools';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
import { useTheme } from '../../../theme';

export interface CanvasToolsBarProps {
  testID: string;
  /** While an overlay shape is being drawn, the bar is replaced by the draw bar. */
  drawTool: OverlayDrawTool | null;
  canFinish: boolean;
  onFinishDraw: () => void;
  onCancelDraw: () => void;
  /** The add-object action bar. */
  addActions: React.ReactNode;
  /** The mode-toggle action bar. */
  modeActions: React.ReactNode;
}

/** The toolbar above a canvas: add actions and mode toggles side by side, stacked when compact. */
const CanvasToolsBar: React.FC<CanvasToolsBarProps> = ({
  testID,
  drawTool,
  canFinish,
  onFinishDraw,
  onCancelDraw,
  addActions,
  modeActions,
}) => {
  const { colors } = useTheme();
  const { isCompact } = useResponsiveLayout();
  const styles = StyleSheet.create({
    tools: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    wideRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    rowDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: 8,
    },
    columnDivider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
      backgroundColor: colors.border,
      marginHorizontal: 4,
    },
    modesRow: { flexDirection: 'row', alignItems: 'center' },
  });

  if (drawTool) {
    return (
      <OverlayDrawBar
        tool={drawTool}
        canFinish={canFinish}
        onFinish={onFinishDraw}
        onCancel={onCancelDraw}
      />
    );
  }
  if (isCompact) {
    return (
      <View style={styles.tools} testID={testID}>
        {modeActions}
        <View style={styles.rowDivider} />
        {addActions}
      </View>
    );
  }
  return (
    <View style={styles.tools} testID={testID}>
      <View style={styles.wideRow}>
        {addActions}
        <View style={styles.modesRow}>
          <View style={styles.columnDivider} />
          {modeActions}
        </View>
      </View>
    </View>
  );
};

export default CanvasToolsBar;
