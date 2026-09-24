import { CANVAS_OVERLAY_STAMP_DEFAULT_SIZE, type CanvasOverlayType } from '@keres/shared';
import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapIcon from '@/src/components/common/display/MapIcon/MapIcon';
import { useTheme } from '../../../../theme';

type StampOverlay = Extract<CanvasOverlayType, { kind: 'stamp' }>;

/**
 * One icon stamp on a Board or Location Map: a tappable-later circle with its glyph and
 * name, the same visual language as map points. Stamps ride the node plane as native
 * views because Skia cannot render Ionicons glyphs; the vector layer skips them.
 * Render-only in slice 1: selection and dragging arrive with the drawing tools.
 */
const CanvasStampView: React.FC<{ stamp: StampOverlay }> = ({ stamp }) => {
  const { colors } = useTheme();
  const size = stamp.size ?? CANVAS_OVERLAY_STAMP_DEFAULT_SIZE;
  const styles = useMemo(
    () =>
      StyleSheet.create({
        stamp: {
          position: 'absolute',
          left: stamp.x - size / 2,
          top: stamp.y - size / 2,
          width: size,
          alignItems: 'center',
          zIndex: stamp.zIndex ?? 0,
          ...(Platform.OS === 'web' ? ({ userSelect: 'none' } as Record<string, string>) : {}),
        },
        circle: {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1.5,
          borderColor: stamp.color ?? colors.primary,
        },
        label: {
          fontSize: Platform.OS === 'web' ? 10 : 12,
          fontWeight: '600',
          color: colors.text,
          textAlign: 'center',
          marginTop: 2,
          maxWidth: 120,
          textShadowColor: colors.background,
          textShadowRadius: 3,
          textShadowOffset: { width: 0, height: 0 },
        },
      }),
    [colors, size, stamp.color, stamp.x, stamp.y, stamp.zIndex],
  );
  return (
    <View style={styles.stamp}>
      <View style={styles.circle}>
        <MapIcon name={stamp.icon} size={size * 0.55} color={stamp.color ?? colors.primary} />
      </View>
      {!!stamp.label && <Text style={styles.label}>{stamp.label}</Text>}
    </View>
  );
};

export default CanvasStampView;
