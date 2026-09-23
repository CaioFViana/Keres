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
import type {
  AddObjectsAction,
  OverlayDrawTool,
} from '@/src/components/features/graphs/CanvasOverlay/overlayTools';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
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
  layoutEditing: boolean;
  connectionMode: boolean;
  overlayEditing: boolean;
  onToggleLayout: () => void;
  onToggleConnectionMode: () => void;
  onToggleOverlayEdit: () => void;
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
  layoutEditing,
  connectionMode,
  overlayEditing,
  onToggleLayout,
  onToggleConnectionMode,
  onToggleOverlayEdit,
}) => {
  const { t } = useTranslation();
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
  const addActions = (
    <CanvasActionBar testID="board-add-actions">
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
    </CanvasActionBar>
  );
  const modeActions = (
    <CanvasActionBar testID="board-modes">
      <CanvasActionBarButton
        testID="action-board-connection-mode"
        icon={connectionMode ? 'git-merge' : 'git-merge-outline'}
        active={connectionMode}
        label={t('graph_connection_mode')}
        onPress={onToggleConnectionMode}
      />
      <CanvasActionBarButton
        testID="action-board-edit-overlays"
        icon={overlayEditing ? 'checkmark-circle-outline' : 'create-outline'}
        active={overlayEditing}
        label={t('objects_edit')}
        onPress={onToggleOverlayEdit}
      />
      <CanvasActionBarButton
        testID="action-board-edit-layout"
        icon={layoutEditing ? 'checkmark-circle-outline' : 'move-outline'}
        active={layoutEditing}
        label={t('board_edit_layout')}
        onPress={onToggleLayout}
      />
    </CanvasActionBar>
  );
  if (isCompact) {
    return (
      <View style={styles.tools} testID="board-tools">
        {modeActions}
        <View style={styles.rowDivider} />
        {addActions}
      </View>
    );
  }
  return (
    <View style={styles.tools} testID="board-tools">
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

export default BoardCanvasTools;
