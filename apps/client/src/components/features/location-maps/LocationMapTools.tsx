import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import Button from '@/src/components/common/controls/Button/Button';
import AddObjectsPill from '@/src/components/features/graphs/CanvasOverlay/AddObjectsPill';
import OverlayDrawBar from '@/src/components/features/graphs/CanvasOverlay/OverlayDrawBar';
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
}

/** The pickers above the map: image bases, location points, markers and drawn objects. */
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
    pointRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
    pointControl: { flex: 1 },
    objectsRow: { marginTop: 8 },
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
      <MultiSelectPill
        options={imageOptions}
        selectedValues={[]}
        onSelectionChange={onAddImages}
        placeholder={t('location_map_add_images')}
        noOptionsText={t('location_map_no_images')}
        searchPlaceholder={t('search')}
      />
      <View style={styles.pointRow}>
        <MultiSelectPill
          style={styles.pointControl}
          options={locationOptions}
          selectedValues={[]}
          onSelectionChange={onAddLocations}
          placeholder={t('location_map_add_locations')}
          noOptionsText={t('location_map_no_locations')}
          searchPlaceholder={t('search')}
        />
        <View style={styles.pointControl}>
          <Button onPress={onAddMarker} style={{ height: 50 }}>
            {t('location_map_add_marker')}
          </Button>
        </View>
      </View>
      <View style={styles.objectsRow}>
        <AddObjectsPill includeNote={false} onAction={onObjectsAction} />
      </View>
    </View>
  );
};

export default LocationMapTools;
