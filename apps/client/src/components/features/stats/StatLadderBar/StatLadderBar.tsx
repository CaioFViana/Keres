import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../../../theme';
import type { StatTier } from '@keres/shared/graphs/statLadder';
import { buildStatLadderBar } from '@keres/shared/graphs/statLadderBarLayout';

/**
 * A régua de tiers de um status: onde cada degrau começa e onde o valor do personagem cai.
 *
 * Existe porque o campo de valor é um número solto - sem isto o autor não tem como saber que
 * 100 é "C" nesta escada, nem quanto falta para o próximo degrau.
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
/** Folga acima da faixa para o ponto do valor caber inteiro em vez de ser cortado. */
const TRACK_TOP = VALUE_DOT_RADIUS_OVERFLOW - TRACK_HEIGHT / 2;

export function StatLadderBar({ ladder, value }: StatLadderBarProps) {
  const { colors } = useTheme();
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
      {layout ? (
        <Svg width={layout.width} height={height}>
          {layout.segments.map((segment) => (
            <Rect
              key={`segment-${segment.index}`}
              x={segment.x}
              y={TRACK_TOP}
              width={segment.width}
              height={TRACK_HEIGHT}
              // Faixas alternadas: sem elas os degraus viram uma barra lisa com riscos soltos.
              fill={segment.index % 2 === 0 ? colors.surface : colors.primaryContainer}
              stroke={colors.border}
              strokeWidth={StyleSheet.hairlineWidth}
            />
          ))}

          {/* A faixa além do topo da escada, tracejada como o anel externo do radar: ainda é
              o último degrau, mas fora da escala que o autor cadastrou. */}
          <Rect
            x={layout.overflow.x}
            y={TRACK_TOP}
            width={layout.overflow.width}
            height={TRACK_HEIGHT}
            fill="none"
            stroke={colors.textSecondary}
            strokeWidth={1}
            strokeDasharray="3 3"
          />

          {/* Traços e rótulos em duas passadas em vez de um Fragment por marca: o
              react-native-svg nativo percorre os filhos diretos do Svg, e agrupar dentro de um
              Fragment é justamente o tipo de coisa que funciona na web e falha no aparelho. */}
          {layout.markers.map((marker, index) => (
            <Line
              key={`tick-${index}`}
              x1={marker.x}
              y1={TRACK_TOP}
              x2={marker.x}
              y2={trackBottom + TICK_OVERHANG}
              stroke={colors.border}
              strokeWidth={1}
            />
          ))}
          {layout.markers.map((marker, index) =>
            marker.showLabel ? (
              <SvgText
                key={`label-${index}`}
                x={marker.x}
                y={height - 2}
                fontSize={10}
                // Os rótulos das pontas encostariam na borda se ficassem centrados.
                textAnchor={
                  index === 0 ? 'start' : index === layout.markers.length - 1 ? 'end' : 'middle'
                }
                fill={colors.textSecondary}
              >
                {marker.label}
              </SvgText>
            ) : null,
          )}

          {layout.value ? (
            <Line
              x1={layout.value.x}
              y1={TRACK_TOP - 1}
              x2={layout.value.x}
              y2={trackBottom + 1}
              stroke={colors.primary}
              strokeWidth={2}
            />
          ) : null}
          {layout.value ? (
            <Circle
              cx={layout.value.x}
              cy={valueCenterY}
              r={layout.value.isOverflow ? VALUE_DOT_RADIUS_OVERFLOW : VALUE_DOT_RADIUS}
              fill={colors.primary}
            />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

export default StatLadderBar;
