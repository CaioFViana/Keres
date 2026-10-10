import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../theme';

interface Props {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onExport?: () => void;
  exporting?: boolean;
  exportLabel?: string;
  /** Zoom and fit accessibility labels; without them the shared canvas strings are used. */
  labels?: { zoomIn: string; zoomOut: string; fit: string };
  /** Only the maps with edge labels can switch them; the others leave this out. */
  edgeLabels?: {
    visible: boolean;
    label: string;
    onToggle: () => void;
  };
  /**
   * `map` is the cluster on the graph maps: no focus outline on web, and it does not pass touches
   * through to the canvas underneath.
   */
  variant?: 'canvas' | 'map';
}

/**
 * The floating zoom / fit / save-as-image cluster used by the story map and the other SVG screens.
 */
const GraphCanvasControls: React.FC<Props> = ({
  onZoomIn,
  onZoomOut,
  onFit,
  onExport,
  exporting = false,
  exportLabel,
  labels,
  edgeLabels,
  variant = 'canvas',
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const isMap = variant === 'map';
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
          ...(isMap ? { outlineWidth: 0 } : null),
        },
      }),
    [colors, isMap],
  );

  return (
    <View style={styles.controls} pointerEvents={isMap ? undefined : 'box-none'}>
      <TouchableOpacity
        style={styles.controlButton}
        onPress={onZoomIn}
        accessibilityLabel={labels?.zoomIn ?? t('zoom_in')}
      >
        <Ionicons name="add" size={22} color={colors.text} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.controlButton}
        onPress={onZoomOut}
        accessibilityLabel={labels?.zoomOut ?? t('zoom_out')}
      >
        <Ionicons name="remove" size={22} color={colors.text} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.controlButton}
        onPress={onFit}
        accessibilityLabel={labels?.fit ?? t('fit_to_screen')}
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
      {onExport && (
        <TouchableOpacity
          style={styles.controlButton}
          onPress={onExport}
          disabled={exporting}
          accessibilityLabel={exportLabel ?? t('story_map_export')}
        >
          {exporting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="image-outline" size={20} color={colors.text} />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

export default GraphCanvasControls;
