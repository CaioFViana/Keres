import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import MultiSelectPill, {
  type MultiSelectGroup,
} from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import {
  CanvasActionBar,
  CanvasActionBarButton,
} from '@/src/components/features/graphs/CanvasActionBar/CanvasActionBar';
import AddObjectsPill from '@/src/components/features/graphs/CanvasOverlay/AddObjectsPill';
import OverlayDrawBar from '@/src/components/features/graphs/CanvasOverlay/OverlayDrawBar';
import OverlaySelectBar from '@/src/components/features/graphs/CanvasOverlay/OverlaySelectBar';
import type {
  AddObjectsAction,
  OverlayDrawTool,
} from '@/src/components/features/graphs/CanvasOverlay/overlayTools';
import { useTheme } from '../../../theme';

interface BoardCanvasToolsProps {
  groupedOptions: MultiSelectGroup[];
  pickerValues: string[];
  onPickEntity: (values: string[]) => void;
  onAddNote: () => void;
  onObjectsAction: (action: AddObjectsAction) => void;
  drawTool: OverlayDrawTool | null;
  canFinish: boolean;
  onFinishDraw: () => void;
  onCancelDraw: () => void;
  selectMode: boolean;
  onDoneSelect: () => void;
}

/** The icon actions above the board: entity pins, objects, notes and edit. */
const BoardCanvasTools: React.FC<BoardCanvasToolsProps> = ({
  groupedOptions,
  pickerValues,
  onPickEntity,
  onAddNote,
  onObjectsAction,
  drawTool,
  canFinish,
  onFinishDraw,
  onCancelDraw,
  selectMode,
  onDoneSelect,
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
  if (selectMode) {
    return <OverlaySelectBar onDone={onDoneSelect} />;
  }
  return (
    <View style={styles.tools}>
      <CanvasActionBar>
        <MultiSelectPill
          groups={groupedOptions}
          selectedValues={pickerValues}
          onSelectionChange={onPickEntity}
          placeholder={t('board_add_entity')}
          noOptionsText={t('board_no_entities')}
          singleSelect
          trigger={(open) => (
            <CanvasActionBarButton
              testID="action-add-entity"
              icon="cube-outline"
              label={t('board_add_entity')}
              onPress={open}
            />
          )}
        />
        <AddObjectsPill
          includeNote={false}
          onAction={onObjectsAction}
          trigger={(open) => (
            <CanvasActionBarButton
              testID="action-add-objects"
              icon="shapes-outline"
              label={t('objects_add')}
              onPress={open}
            />
          )}
        />
        <CanvasActionBarButton
          testID="action-add-note"
          icon="document-text-outline"
          label={t('board_add_note')}
          onPress={onAddNote}
        />
        <CanvasActionBarButton
          testID="action-edit-overlays"
          icon="create-outline"
          label={t('objects_edit')}
          onPress={() => onObjectsAction('select')}
        />
      </CanvasActionBar>
    </View>
  );
};

export default BoardCanvasTools;
