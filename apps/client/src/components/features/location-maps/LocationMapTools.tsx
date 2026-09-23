import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
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

interface Props {
  imageOptions: { label: string; value: string }[];
  locationOptions: { label: string; value: string }[];
  onAddImages: (values: string[]) => void;
  onAddLocations: (values: string[]) => void;
  onAddMarker: () => void;
  onObjectsAction: (action: AddObjectsAction) => void;
  drawTool: OverlayDrawTool | null;
  canFinish: boolean;
  onFinishDraw: () => void;
  onCancelDraw: () => void;
  layoutEditing: boolean;
  connectionMode: boolean;
  overlayEditing: boolean;
  trajectoriesActive: boolean;
  onToggleLayout: () => void;
  onToggleConnectionMode: () => void;
  onToggleOverlayEdit: () => void;
  onOpenTrajectories: () => void;
}

/** The icon actions above the map: image bases, location points, markers, objects, edit. */
const LocationMapTools: React.FC<Props> = ({
  imageOptions,
  locationOptions,
  onAddImages,
  onAddLocations,
  onAddMarker,
  onObjectsAction,
  drawTool,
  canFinish,
  onFinishDraw,
  onCancelDraw,
  layoutEditing,
  connectionMode,
  overlayEditing,
  trajectoriesActive,
  onToggleLayout,
  onToggleConnectionMode,
  onToggleOverlayEdit,
  onOpenTrajectories,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
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
    <CanvasActionBar testID="location-map-add-actions">
        <MultiSelectPill
          options={imageOptions}
          selectedValues={[]}
          onSelectionChange={onAddImages}
          placeholder={t('location_map_add_images')}
          noOptionsText={t('location_map_no_images')}
          searchPlaceholder={t('search')}
          trigger={(open) => (
            <CanvasActionBarButton
              testID="action-add-images"
              icon="image-outline"
              label={t('location_map_add_images')}
              onPress={open}
            />
          )}
        />
        <MultiSelectPill
          options={locationOptions}
          selectedValues={[]}
          onSelectionChange={onAddLocations}
          placeholder={t('location_map_add_locations')}
          noOptionsText={t('location_map_no_locations')}
          searchPlaceholder={t('search')}
          trigger={(open) => (
            <CanvasActionBarButton
              testID="action-add-locations"
              icon="location-outline"
              label={t('location_map_add_locations')}
              onPress={open}
            />
          )}
        />
        <CanvasActionBarButton
          testID="action-add-marker"
          icon="pin-outline"
          label={t('location_map_add_marker')}
          onPress={onAddMarker}
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
    </CanvasActionBar>
  );
  const modeActions = (
    <CanvasActionBar testID="location-map-modes">
      <CanvasActionBarButton
        testID="action-connection-mode"
        icon={connectionMode ? 'git-merge' : 'git-merge-outline'}
        active={connectionMode}
        label={t('graph_connection_mode')}
        onPress={onToggleConnectionMode}
      />
      <CanvasActionBarButton
        testID="action-trajectories"
        icon="footsteps"
        active={trajectoriesActive}
        label={t('trajectory_show')}
        onPress={onOpenTrajectories}
      />
      <CanvasActionBarButton
        testID="action-edit-overlays"
        icon={overlayEditing ? 'checkmark-circle-outline' : 'create-outline'}
        active={overlayEditing}
        label={t('objects_edit')}
        onPress={onToggleOverlayEdit}
      />
      <CanvasActionBarButton
        testID="action-edit-layout"
        icon={layoutEditing ? 'checkmark-circle-outline' : 'move-outline'}
        active={layoutEditing}
        label={t('board_edit_layout')}
        onPress={onToggleLayout}
      />
    </CanvasActionBar>
  );
  if (isCompact) {
    return (
      <View style={styles.tools} testID="location-map-tools">
        {modeActions}
        <View style={styles.rowDivider} />
        {addActions}
      </View>
    );
  }
  return (
    <View style={styles.tools} testID="location-map-tools">
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

export default LocationMapTools;
