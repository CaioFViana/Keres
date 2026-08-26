import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';
import type { StatRadarLayout } from '@keres/shared/graphs/statRadarLayout';
import { useTheme } from '../../../../theme';

/**
 * The stats radar. Unlike the app's graph canvases, it has no pan/zoom: the drawing fits entirely on
 * screen by construction, so `usePanZoomCanvas` does not apply here.
 *
 * All the geometry arrives ready from `buildStatRadarLayout` - this component only paints.
 */
interface StatRadarChartProps {
  /** `null` when there are not enough axes; in that case the message takes the drawing's place. */
  layout: StatRadarLayout | null;
  emptyMessage: string;
}

export function StatRadarChart({ layout, emptyMessage }: StatRadarChartProps) {
  const { colors } = useTheme();

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

  return (
    <View style={styles.container}>
      <Svg width={layout.size} height={layout.size} accessibilityRole="image">
        {layout.rings.map((ring, index) => (
          <Polygon
            key={`ring-${index}`}
            points={ring.points}
            fill={ring.isOverflow ? 'none' : colors.surface}
            fillOpacity={ring.isOverflow ? 0 : 0.35}
            stroke={colors.border}
            strokeWidth={1}
            // A dashed stroke marks the overshoot band: whatever goes past it is above the scale.
            strokeDasharray={ring.isOverflow ? '4 4' : undefined}
          />
        ))}
        {layout.axes.map((axis) => (
          <Line
            key={`axis-${axis.statId}`}
            x1={layout.center.x}
            y1={layout.center.y}
            x2={axis.end.x}
            y2={axis.end.y}
            stroke={colors.border}
            strokeWidth={1}
          />
        ))}
        {layout.series.map((series) => (
          <Polygon
            key={`series-${series.id}`}
            points={series.points}
            fill={series.color}
            fillOpacity={0.22}
            stroke={series.color}
            strokeWidth={2}
          />
        ))}
        {layout.series.map((series) =>
          series.vertices.map((vertex) => (
            <Circle
              key={`vertex-${series.id}-${vertex.statId}`}
              cx={vertex.x}
              cy={vertex.y}
              r={vertex.isOverflow ? 5 : 3.5}
              fill={series.color}
            />
          )),
        )}
        {layout.axes.map((axis) => (
          <SvgText
            key={`label-${axis.statId}`}
            x={axis.labelPoint.x}
            y={axis.labelPoint.y + 4}
            fontSize={11}
            textAnchor={axis.textAnchor}
            fill={colors.text}
          >
            {axis.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

export default StatRadarChart;
