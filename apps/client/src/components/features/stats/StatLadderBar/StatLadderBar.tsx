import {
  Canvas,
  Circle,
  DashPathEffect,
  Line,
  Rect,
  Text as SkiaText,
} from '@shopify/react-native-skia';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StatTier } from '@keres/shared/graphs/statLadder';
import { buildStatLadderBar } from '@keres/shared/graphs/statLadderBarLayout';
import { measureEdgeLabelWidth } from '../../graphs/SkiaEdgeCanvas/measureEdgeLabelWidth';
import SkiaOverlayErrorBoundary from '../../graphs/SkiaEdgeCanvas/SkiaOverlayErrorBoundary';
import { useCanvasKitReady } from '../../graphs/SkiaEdgeCanvas/useCanvasKitReady';
import { useEdgeFont } from '../../graphs/SkiaEdgeCanvas/useEdgeFont';
import { useTheme } from '../../../../theme';

/**
 * A stat's tier ruler: where each rung starts and where the character's value lands.
 *
 * It exists because the value field is a bare number - without this the author has no way to know that
 * 100 is "C" on this ladder, nor how far the next rung is.
 */
interface StatLadderBarProps {
  ladder: readonly StatTier[];
  value: number | null;
}

const TRACK_HEIGHT = 14;
const LABEL_HEIGHT = 14;
const TICK_OVERHANG = 3;
const VALUE_DOT_RADIUS = 6;
const VALUE_DOT_RADIUS_OVERFLOW = 7.5;
const LABEL_FONT_SIZE = 10;
/** Folga acima da faixa para o ponto do valor caber inteiro em vez de ser cortado. */
const TRACK_TOP = VALUE_DOT_RADIUS_OVERFLOW - TRACK_HEIGHT / 2;

export function StatLadderBar({ ladder, value }: StatLadderBarProps) {
  const { colors } = useTheme();
  const ready = useCanvasKitReady();
  const font = useEdgeFont(LABEL_FONT_SIZE);
  const [width, setWidth] = useState(0);

  const layout = useMemo(
    () =>
      width > 0
        ? buildStatLadderBar({ ladder, value, width, inset: VALUE_DOT_RADIUS_OVERFLOW })
        : null,
    [ladder, value, width],
  );

  const styles = useMemo(() => StyleSheet.create({ container: { width: '100%' } }), []);
  const trackBottom = TRACK_TOP + TRACK_HEIGHT;
  const height = trackBottom + TICK_OVERHANG + LABEL_HEIGHT;
  const valueCenterY = TRACK_TOP + TRACK_HEIGHT / 2;

  return (
    <View style={styles.container} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {/* On web the canvas also waits for the CanvasKit boot; the sized box stays either way. */}
      {layout && ready ? (
        <SkiaOverlayErrorBoundary canvas="stat-ladder">
          <Canvas style={{ width: layout.width, height }}>
            {layout.segments.map((segment) => (
              <React.Fragment key={`segment-${segment.index}`}>
                {/* Faixas alternadas: sem elas os degraus viram uma barra lisa com riscos soltos. */}
                <Rect
                  x={segment.x}
                  y={TRACK_TOP}
                  width={segment.width}
                  height={TRACK_HEIGHT}
                  color={segment.index % 2 === 0 ? colors.surface : colors.primaryContainer}
                />
                <Rect
                  x={segment.x}
                  y={TRACK_TOP}
                  width={segment.width}
                  height={TRACK_HEIGHT}
                  style="stroke"
                  color={colors.border}
                  strokeWidth={StyleSheet.hairlineWidth}
                />
              </React.Fragment>
            ))}

            {/* A faixa além do topo da escada, tracejada como o anel externo do radar: ainda é
                o último degrau, mas fora da escala que o autor cadastrou. */}
            <Rect
              x={layout.overflow.x}
              y={TRACK_TOP}
              width={layout.overflow.width}
              height={TRACK_HEIGHT}
              style="stroke"
              color={colors.textSecondary}
              strokeWidth={1}
            >
              <DashPathEffect intervals={[3, 3]} />
            </Rect>

            {layout.markers.map((marker, index) => (
              <Line
                key={`tick-${index}`}
                p1={{ x: marker.x, y: TRACK_TOP }}
                p2={{ x: marker.x, y: trackBottom + TICK_OVERHANG }}
                color={colors.border}
                strokeWidth={1}
              />
            ))}
            {font &&
              layout.markers.map((marker, index) => {
                if (!marker.showLabel) return null;
                const textWidth = measureEdgeLabelWidth(font, marker.label, LABEL_FONT_SIZE);
                // The end labels would touch the border if they were centred.
                const x =
                  index === 0
                    ? marker.x
                    : index === layout.markers.length - 1
                      ? marker.x - textWidth
                      : marker.x - textWidth / 2;
                return (
                  <SkiaText
                    key={`label-${index}`}
                    x={x}
                    y={height - 2}
                    font={font}
                    text={marker.label}
                    color={colors.textSecondary}
                  />
                );
              })}

            {layout.value ? (
              <Line
                p1={{ x: layout.value.x, y: TRACK_TOP - 1 }}
                p2={{ x: layout.value.x, y: trackBottom + 1 }}
                color={colors.primary}
                strokeWidth={2}
              />
            ) : null}
            {layout.value ? (
              <Circle
                cx={layout.value.x}
                cy={valueCenterY}
                r={layout.value.isOverflow ? VALUE_DOT_RADIUS_OVERFLOW : VALUE_DOT_RADIUS}
                color={colors.primary}
              />
            ) : null}
          </Canvas>
        </SkiaOverlayErrorBoundary>
      ) : null}
    </View>
  );
}

export default StatLadderBar;
