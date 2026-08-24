import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path, Polygon, Rect as SvgRect, Text as SvgText } from 'react-native-svg';
import GraphCanvasFrame from '../GraphCanvasFrame/GraphCanvasFrame';
import type { PanZoomCanvasHandle} from '../../../../hooks/usePanZoomCanvas';
import { usePanZoomCanvas } from '../../../../hooks/usePanZoomCanvas';
import { useTheme } from '../../../../theme';
import type { GraphNode, StoryGraphLayout } from '../../../../utils/storyGraphLayout';

/**
 * Desenho interativo do mapa da história.
 *
 * Duas camadas sobre as mesmas coordenadas: as arestas em SVG (curva com ponta de seta é o
 * que SVG faz bem) e as cenas como Views nativas por cima. Os nós não são SVG de propósito -
 * como View eles ganham quebra de texto de verdade, `numberOfLines` e toque nativo, então
 * tocar numa cena não precisa de cálculo de acerto manual: o React Native já resolve isso,
 * inclusive com o mapa ampliado.
 *
 * Pan e zoom vêm de `usePanZoomCanvas`, compartilhado com o mapa de relações entre
 * personagens - ver o hook para o porquê de `PanResponder` em vez de
 * `react-native-gesture-handler`.
 */

export type StoryGraphCanvasHandle = PanZoomCanvasHandle;

interface StoryGraphCanvasProps {
  layout: StoryGraphLayout;
  showEdgeLabels: boolean;
  selectedNodeId: string | null;
  onSelectNode: (node: GraphNode) => void;
}

const StoryGraphCanvas = forwardRef<StoryGraphCanvasHandle, StoryGraphCanvasProps>(
  ({ layout, showEdgeLabels, selectedNodeId, onSelectNode }, ref) => {
    const { colors } = useTheme();
    const panZoom = usePanZoomCanvas(ref, layout);

    const styles = useMemo(
      () =>
        StyleSheet.create({
          node: {
            position: 'absolute',
            borderRadius: 10,
            overflow: 'hidden',
            outlineWidth: 0,
          },
          nodeInner: {
            flex: 1,
            marginTop: 5,
            borderRadius: 9,
            borderWidth: 1.2,
            paddingHorizontal: 6,
            paddingTop: 6,
            paddingBottom: 3,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
          },
          nodeLabel: {
            fontSize: 12.5,
            fontWeight: '600',
            color: colors.text,
            textAlign: 'center',
          },
          nodeChapter: {
            fontSize: 9.5,
            marginTop: 3,
            textAlign: 'center',
          },
        }),
      [colors],
    );

    return (
      <GraphCanvasFrame width={layout.width} height={layout.height} {...panZoom}>
        <Svg width={layout.width} height={layout.height}>
          {layout.edges.map((edge) => {
            const isReturn = edge.kind === 'backward' || edge.kind === 'self';
            return (
              <React.Fragment key={edge.id}>
                <Path
                  d={edge.path}
                  fill="none"
                  stroke={edge.color}
                  strokeWidth={1.8}
                  strokeOpacity={isReturn ? 0.9 : 0.7}
                  strokeDasharray={isReturn ? '7,5' : undefined}
                />
                <Polygon
                  points={edge.arrowPoints}
                  fill={edge.color}
                  fillOpacity={isReturn ? 0.9 : 0.7}
                />
              </React.Fragment>
            );
          })}

          {showEdgeLabels &&
            layout.edges.map((edge) => {
              const label = edge.label.trim();
              if (!label) return null;
              const clipped = label.length > 26 ? `${label.slice(0, 25)}…` : label;
              const width = clipped.length * 6.4 + 10;
              return (
                <React.Fragment key={`label-${edge.id}`}>
                  <SvgRect
                    x={edge.labelPosition.x - width / 2}
                    y={edge.labelPosition.y - 8}
                    width={width}
                    height={16}
                    rx={4}
                    fill={colors.background}
                    fillOpacity={0.92}
                  />
                  <SvgText
                    x={edge.labelPosition.x}
                    y={edge.labelPosition.y + 4}
                    fontSize={10}
                    textAnchor="middle"
                    fill={colors.textSecondary}
                  >
                    {clipped}
                  </SvgText>
                </React.Fragment>
              );
            })}
        </Svg>

        {layout.nodes.map((node) => {
          const isSelected = node.id === selectedNodeId;
          const borderColor = isSelected
            ? colors.primary
            : node.isStart
              ? colors.accent
              : node.isFinish
                ? colors.error
                : colors.border;

          return (
            <TouchableOpacity
              key={node.id}
              activeOpacity={0.75}
              onPress={() => onSelectNode(node)}
              style={[
                styles.node,
                {
                  left: node.x,
                  top: node.y,
                  width: node.width,
                  height: node.height,
                  backgroundColor: node.chapterColor,
                },
              ]}
            >
              <View
                style={[
                  styles.nodeInner,
                  {
                    borderColor,
                    borderWidth: isSelected || node.isStart || node.isFinish ? 2.5 : 1.2,
                  },
                ]}
              >
                {node.labelLines.map((line, index) => (
                  <Text key={index} style={styles.nodeLabel} numberOfLines={1}>
                    {line}
                  </Text>
                ))}
                {!!node.chapterName && (
                  <Text
                    style={[styles.nodeChapter, { color: node.chapterColor }]}
                    numberOfLines={1}
                  >
                    {node.chapterName}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </GraphCanvasFrame>
    );
  },
);

StoryGraphCanvas.displayName = 'StoryGraphCanvas';

export default StoryGraphCanvas;
