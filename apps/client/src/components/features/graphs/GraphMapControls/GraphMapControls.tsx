import { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from '@keres/shared/theme/ThemeColors';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';

interface GraphMapControlsProps {
  colors: ThemeColors;
  labels: {
    zoomIn: string;
    zoomOut: string;
    fit: string;
    export: string;
  };
  onZoomIn(): void;
  onZoomOut(): void;
  onFit(): void;
  /** Only the maps with edge labels can switch them; the others leave this out. */
  edgeLabels?: {
    visible: boolean;
    label: string;
    onToggle(): void;
  };
  exporting: boolean;
  onExport(): void | Promise<void>;
}

/**
 * The floating cluster on a map canvas: zoom, fit, the edge-label switch and the image export.
 * Presentational - the screen owns the canvas ref and the export.
 */
const GraphMapControls = ({
  colors,
  labels,
  onZoomIn,
  onZoomOut,
  onFit,
  edgeLabels,
  exporting,
  onExport,
}: GraphMapControlsProps) => {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        controls: {
          position: 'absolute',
          right: 14,
          bottom: 18,
        },
        controlButton: {
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 9,
          backgroundColor: colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          outlineWidth: 0,
        },
      }),
    [colors],
  );

  return (
    <View style={styles.controls}>
      <TouchableOpacity
        style={styles.controlButton}
        onPress={onZoomIn}
        accessibilityLabel={labels.zoomIn}
      >
        <Ionicons name="add" size={22} color={colors.text} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.controlButton}
        onPress={onZoomOut}
        accessibilityLabel={labels.zoomOut}
      >
        <Ionicons name="remove" size={22} color={colors.text} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.controlButton}
        onPress={onFit}
        accessibilityLabel={labels.fit}
      >
        <Ionicons name="scan-outline" size={20} color={colors.text} />
      </TouchableOpacity>
      {edgeLabels && (
        <TouchableOpacity
          style={styles.controlButton}
          onPress={edgeLabels.onToggle}
          accessibilityLabel={edgeLabels.label}
        >
          <Ionicons
            name={edgeLabels.visible ? 'chatbox' : 'chatbox-outline'}
            size={19}
            color={edgeLabels.visible ? colors.primary : colors.text}
          />
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={styles.controlButton}
        onPress={onExport}
        disabled={exporting}
        accessibilityLabel={labels.export}
      >
        {exporting ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="image-outline" size={20} color={colors.text} />
        )}
      </TouchableOpacity>
    </View>
  );
};

export default GraphMapControls;
