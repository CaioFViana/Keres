import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';
import type { StatRadarLayout } from '../../../../utils/statRadarLayout';
import { useTheme } from '../../../../theme';

/**
 * O radar dos status. Diferente dos canvas de grafo do app, não tem pan/zoom: o desenho cabe
 * inteiro na tela por construção, então `usePanZoomCanvas` não se aplica aqui.
 *
 * Toda a geometria vem pronta de `buildStatRadarLayout` - este componente só pinta.
 */
interface StatRadarChartProps {
  /** `null` quando não há eixos suficientes; nesse caso a mensagem toma o lugar do desenho. */
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
            // Tracejado marca a faixa de transbordo: o que passa dali está acima da escala.
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
