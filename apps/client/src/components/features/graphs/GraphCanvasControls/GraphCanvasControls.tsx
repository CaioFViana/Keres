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
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
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
        },
      }),
    [colors],
  );

  return (
    <View style={styles.controls} pointerEvents="box-none">
      <TouchableOpacity
        style={styles.controlButton}
        onPress={onZoomIn}
        accessibilityLabel={t('zoom_in')}
      >
        <Ionicons name="add" size={22} color={colors.text} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.controlButton}
        onPress={onZoomOut}
        accessibilityLabel={t('zoom_out')}
      >
        <Ionicons name="remove" size={22} color={colors.text} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.controlButton}
        onPress={onFit}
        accessibilityLabel={t('fit_to_screen')}
      >
        <Ionicons name="scan-outline" size={20} color={colors.text} />
      </TouchableOpacity>
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
