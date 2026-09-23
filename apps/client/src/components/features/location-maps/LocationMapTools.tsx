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
import OverlaySelectBar from '@/src/components/features/graphs/CanvasOverlay/OverlaySelectBar';
import type {
  AddObjectsAction,
  OverlayDrawTool,
} from '@/src/components/features/graphs/CanvasOverlay/overlayTools';
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
  selectMode: boolean;
  onDoneSelect: () => void;
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
  selectMode,
  onDoneSelect,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

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

export default LocationMapTools;
