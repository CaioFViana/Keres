import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import GraphCanvasFrame from '../GraphCanvasFrame/GraphCanvasFrame';
import type { PanZoomCanvasHandle } from '../../../../hooks/usePanZoomCanvas';
import { usePanZoomCanvas } from '../../../../hooks/usePanZoomCanvas';
import { useTheme } from '../../../../theme';
import type {
  LocationGraphLayout,
  LocationGraphNode,
} from '@keres/shared/graphs/locationGraphLayout';

/**
 * The interactive drawing of the Location structure graph. The same architecture as the app's other
 * two graph canvases (story map, relation map): pan/zoom through `usePanZoomCanvas`, nodes as
 * absolutely positioned native Views, edges as react-native-svg `Path`s.
 *
 * The two edges have different styles so they can be told apart visually without a label on each one:
 * `contains` is a solid line (a hierarchy relation, parent->child), `connected_to` is dashed (a loose
 * spatial relation, with no direction).
 */

export type LocationGraphCanvasHandle = PanZoomCanvasHandle;

interface LocationGraphCanvasProps {
  layout: LocationGraphLayout;
  selectedNodeId: string | null;
  /** Locations the focus filter chose - drawn with the primary outline. */
  highlightedNodeIds?: string[];
  onSelectNode: (node: LocationGraphNode) => void;
}

const LocationGraphCanvas = forwardRef<LocationGraphCanvasHandle, LocationGraphCanvasProps>(
  ({ layout, selectedNodeId, highlightedNodeIds, onSelectNode }, ref) => {
    const { colors } = useTheme();
    const panZoom = usePanZoomCanvas(ref, layout, { freePan: true });

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
  },
);

LocationGraphCanvas.displayName = 'LocationGraphCanvas';

export default LocationGraphCanvas;
