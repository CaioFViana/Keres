import {
  Canvas,
  Circle,
  DashPathEffect,
  Line,
  Path,
  Text as SkiaText,
} from '@shopify/react-native-skia';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StatRadarLayout } from '@keres/shared/graphs/statRadarLayout';
import { measureEdgeLabelWidth } from '../../graphs/SkiaEdgeCanvas/measureEdgeLabelWidth';
import { polygonPointsToPath } from '../../graphs/SkiaEdgeCanvas/polygonPointsToPath';
import SkiaOverlayErrorBoundary from '../../graphs/SkiaEdgeCanvas/SkiaOverlayErrorBoundary';
import { useCanvasKitReady } from '../../graphs/SkiaEdgeCanvas/useCanvasKitReady';
import { useEdgeFont } from '../../graphs/SkiaEdgeCanvas/useEdgeFont';
import { useTheme } from '../../../../theme';

const LABEL_FONT_SIZE = 11;

/**
 * The stats radar. Unlike the app's graph canvases, it has no pan/zoom: the drawing fits entirely on
 * screen by construction, so `useCanvasViewport` does not apply here.
 *
 * All the geometry arrives ready from `buildStatRadarLayout` - this component only paints, on a
 * fixed-size Skia canvas like the app's other drawings. Skia has no polygon drawing, so rings and
 * series cross as closed paths (`polygonPointsToPath`), and no `textAnchor`, so labels are placed
 * by measured width instead. Without a font the labels are skipped, never a blank canvas.
 */
interface StatRadarChartProps {
  /** `null` when there are not enough axes; in that case the message takes the drawing's place. */
  layout: StatRadarLayout | null;
  emptyMessage: string;
}

export function StatRadarChart({ layout, emptyMessage }: StatRadarChartProps) {
  const { colors } = useTheme();
  const ready = useCanvasKitReady();
  const font = useEdgeFont(LABEL_FONT_SIZE);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { alignItems: 'center', justifyContent: 'center' },
        empty: { color: colors.textSecondary, padding: 24, textAlign: 'center' },
      }),
    [colors],
  );

  if (!layout) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>{emptyMessage}</Text>
      </View>
    );
  }

  // On web the canvas waits for the CanvasKit boot; the sized box stays so the layout does not jump.
  if (!ready) {
    return <View style={[styles.container, { width: layout.size, height: layout.size }]} />;
  }

  return (
    <View style={styles.container}>
      <SkiaOverlayErrorBoundary canvas="stat-radar">
        <Canvas style={{ width: layout.size, height: layout.size }} accessibilityRole="image">
          {layout.rings.map((ring, index) => {
            const path = polygonPointsToPath(ring.points);
            return (
              <React.Fragment key={`ring-${index}`}>
                {!ring.isOverflow && <Path path={path} color={colors.surface} opacity={0.35} />}
                <Path path={path} style="stroke" color={colors.border} strokeWidth={1}>
                  {/* A dashed stroke marks the overshoot band: whatever goes past it is above the scale. */}
                  {ring.isOverflow && <DashPathEffect intervals={[4, 4]} />}
                </Path>
              </React.Fragment>
            );
          })}
          {layout.axes.map((axis) => (
            <Line
              key={`axis-${axis.statId}`}
              p1={{ x: layout.center.x, y: layout.center.y }}
              p2={{ x: axis.end.x, y: axis.end.y }}
              color={colors.border}
              strokeWidth={1}
            />
          ))}
          {layout.series.map((series) => {
            const path = polygonPointsToPath(series.points);
            return (
              <React.Fragment key={`series-${series.id}`}>
                <Path path={path} color={series.color} opacity={0.22} />
                <Path path={path} style="stroke" color={series.color} strokeWidth={2} />
              </React.Fragment>
            );
          })}
          {layout.series.map((series) =>
            series.vertices.map((vertex) => (
              <Circle
                key={`vertex-${series.id}-${vertex.statId}`}
                cx={vertex.x}
                cy={vertex.y}
                r={vertex.isOverflow ? 5 : 3.5}
                color={series.color}
              />
            )),
          )}
          {font &&
            layout.axes.map((axis) => {
              const textWidth = measureEdgeLabelWidth(font, axis.label, LABEL_FONT_SIZE);
              const x =
                axis.textAnchor === 'middle'
                  ? axis.labelPoint.x - textWidth / 2
                  : axis.textAnchor === 'end'
                    ? axis.labelPoint.x - textWidth
                    : axis.labelPoint.x;
              return (
                <SkiaText
                  key={`label-${axis.statId}`}
                  x={x}
                  y={axis.labelPoint.y + 4}
                  font={font}
                  text={axis.label}
                  color={colors.text}
                />
              );
            })}
        </Canvas>
      </SkiaOverlayErrorBoundary>
    </View>
  );
}

export default StatRadarChart;
