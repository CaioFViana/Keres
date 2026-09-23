import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import MultiSelectPill, {
  type MultiSelectGroup,
} from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import AddObjectsPill from '@/src/components/features/graphs/CanvasOverlay/AddObjectsPill';
import OverlayDrawBar from '@/src/components/features/graphs/CanvasOverlay/OverlayDrawBar';
import type {
  AddObjectsAction,
  OverlayDrawTool,
} from '@/src/components/features/graphs/CanvasOverlay/overlayTools';
import { useTheme } from '../../../theme';

interface BoardCanvasToolsProps {
  groupedOptions: MultiSelectGroup[];
  pickerValues: string[];
  onPickEntity: (values: string[]) => void;
  onObjectsAction: (action: AddObjectsAction) => void;
  drawTool: OverlayDrawTool | null;
  canFinish: boolean;
  onFinishDraw: () => void;
  onCancelDraw: () => void;
}

/** The pickers above the board: entity pins and the add-objects pill (draw bar while armed). */
const BoardCanvasTools: React.FC<BoardCanvasToolsProps> = ({
  groupedOptions,
  pickerValues,
  onPickEntity,
  onObjectsAction,
  drawTool,
  canFinish,
  onFinishDraw,
  onCancelDraw,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    tools: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    toolRow: { flexDirection: 'row', gap: 8 },
    toolControl: { flex: 1 },
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
  return (
    <View style={styles.tools}>
      <View style={styles.toolRow}>
        <MultiSelectPill
          style={styles.toolControl}
          groups={groupedOptions}
          selectedValues={pickerValues}
          onSelectionChange={onPickEntity}
          placeholder={t('board_add_entity')}
          noOptionsText={t('board_no_entities')}
          singleSelect
        />
        <AddObjectsPill includeNote style={styles.toolControl} onAction={onObjectsAction} />
      </View>
    </View>
  );
};

export default BoardCanvasTools;
