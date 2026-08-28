import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path, Rect as SvgRect, Text as SvgText } from 'react-native-svg';
import GraphCanvasFrame from '../GraphCanvasFrame/GraphCanvasFrame';
import type { PanZoomCanvasHandle } from '../../../../hooks/usePanZoomCanvas';
import { usePanZoomCanvas } from '../../../../hooks/usePanZoomCanvas';
import { useTheme } from '../../../../theme';
import type {
  CharacterRelationGraphLayout,
  RelationGraphNode,
} from '@keres/shared/graphs/characterRelationGraphLayout';

/**
 * The interactive drawing of the character relations map.
 *
 * The same architecture as the story map (`StoryGraphCanvas`), including the pan/zoom
 * (`usePanZoomCanvas`, shared between the two). The edges here are just a straight segment
 * - the relation has no direction, so there is no arrow or curve to draw.
 */

export type CharacterRelationGraphCanvasHandle = PanZoomCanvasHandle;

interface CharacterRelationGraphCanvasProps {
  layout: CharacterRelationGraphLayout;
  showEdgeLabels: boolean;
  selectedNodeId: string | null;
  /** Characters the focus filter chose - drawn with the primary outline. */
  highlightedNodeIds?: string[];
  onSelectNode: (node: RelationGraphNode) => void;
}

const CharacterRelationGraphCanvas = forwardRef<
  CharacterRelationGraphCanvasHandle,
  CharacterRelationGraphCanvasProps
>(({ layout, showEdgeLabels, selectedNodeId, highlightedNodeIds, onSelectNode }, ref) => {
  const { colors } = useTheme();
  const panZoom = usePanZoomCanvas(ref, layout, { freePan: true });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        node: {
          position: 'absolute',
          borderRadius: 22,
          overflow: 'hidden',
          outlineWidth: 0,
        },
        nodeInner: {
          flex: 1,
          borderRadius: 21,
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
            stroke={colors.border}
            strokeWidth={1.6}
            strokeOpacity={0.85}
          />
        ))}

        {showEdgeLabels &&
          layout.edges.map((edge) => {
            const label = edge.label.trim();
            if (!label) return null;
            const clipped = label.length > 22 ? `${label.slice(0, 21)}…` : label;
            const width = clipped.length * 6.2 + 10;
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
        const isHighlighted = highlightedNodeIds?.includes(node.id) ?? false;
        const borderColor = isSelected || isHighlighted
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
                { borderColor, borderWidth: isSelected || isHighlighted ? 2.5 : 1.2 },
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
});

CharacterRelationGraphCanvas.displayName = 'CharacterRelationGraphCanvas';

export default CharacterRelationGraphCanvas;
