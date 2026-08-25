import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import GraphCanvasFrame from '../GraphCanvasFrame/GraphCanvasFrame';
import type { PanZoomCanvasHandle } from '../../../../hooks/usePanZoomCanvas';
import { usePanZoomCanvas } from '../../../../hooks/usePanZoomCanvas';
import { useTheme } from '../../../../theme';
import type { LocationGraphLayout, LocationGraphNode } from '../../../../utils/locationGraphLayout';

/**
 * Desenho interativo do grafo de estrutura de Locations. Mesma arquitetura dos outros dois
 * canvas de grafo do app (mapa de história, mapa de relações): pan/zoom via `usePanZoomCanvas`,
 * nós como Views nativas posicionadas absolutamente, arestas como `Path` do react-native-svg.
 *
 * As duas arestas têm estilo diferente para dar pra distinguir visualmente sem precisar de
 * rótulo em cada uma: `contains` é uma linha sólida (relação de hierarquia, pai->filho),
 * `connected_to` é tracejada (relação espacial solta, sem direção).
 */

export type LocationGraphCanvasHandle = PanZoomCanvasHandle;

interface LocationGraphCanvasProps {
  layout: LocationGraphLayout;
  selectedNodeId: string | null;
  onSelectNode: (node: LocationGraphNode) => void;
}

const LocationGraphCanvas = forwardRef<LocationGraphCanvasHandle, LocationGraphCanvasProps>(
  ({ layout, selectedNodeId, onSelectNode }, ref) => {
    const { colors } = useTheme();
    const panZoom = usePanZoomCanvas(ref, layout);

    const styles = useMemo(
      () =>
        StyleSheet.create({
          node: {
            position: 'absolute',
            borderRadius: 8,
            overflow: 'hidden',
            outlineWidth: 0,
          },
          nodeInner: {
            flex: 1,
            borderRadius: 7,
            borderWidth: 1.2,
            paddingHorizontal: 8,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primaryContainer,
          },
          nodeInnerIsolated: {
            backgroundColor: colors.surface,
            borderStyle: 'dashed',
          },
          nodeLabel: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.text,
            textAlign: 'center',
          },
        }),
      [colors],
    );

    return (
      <GraphCanvasFrame width={layout.width} height={layout.height} {...panZoom}>
        <Svg width={layout.width} height={layout.height}>
          {layout.edges.map((edge) => (
            <Path
              key={edge.id}
              d={edge.path}
              fill="none"
              stroke={edge.relationType === 'contains' ? colors.primary : colors.textSecondary}
              strokeWidth={edge.relationType === 'contains' ? 1.8 : 1.4}
              strokeOpacity={edge.relationType === 'contains' ? 0.9 : 0.65}
              strokeDasharray={edge.relationType === 'connected_to' ? '6,4' : undefined}
            />
          ))}
        </Svg>

        {layout.nodes.map((node) => {
          const isSelected = node.id === selectedNodeId;
          const borderColor = isSelected
            ? colors.primary
            : node.isIsolated
              ? colors.textSecondary
              : colors.border;

          return (
            <TouchableOpacity
              key={node.id}
              activeOpacity={0.75}
              onPress={() => onSelectNode(node)}
              style={[
                styles.node,
                { left: node.x, top: node.y, width: node.width, height: node.height },
              ]}
            >
              <View
                style={[
                  styles.nodeInner,
                  node.isIsolated && styles.nodeInnerIsolated,
                  { borderColor, borderWidth: isSelected ? 2.5 : 1.2 },
                ]}
              >
                {node.labelLines.map((line, index) => (
                  <Text key={index} style={styles.nodeLabel} numberOfLines={1}>
                    {line}
                  </Text>
                ))}
              </View>
            </TouchableOpacity>
          );
        })}
      </GraphCanvasFrame>
    );
  },
);

LocationGraphCanvas.displayName = 'LocationGraphCanvas';

export default LocationGraphCanvas;
