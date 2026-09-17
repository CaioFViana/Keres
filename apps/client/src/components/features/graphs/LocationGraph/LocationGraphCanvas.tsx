import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import GraphCanvasFrame from '../GraphCanvasFrame/GraphCanvasFrame';
import type { CanvasViewportHandle } from '../../../../hooks/useCanvasViewport';
import { useCanvasViewport } from '../../../../hooks/useCanvasViewport';
import { useTheme } from '../../../../theme';
import { spatialRectIntersects } from '@keres/shared';
import type {
  LocationGraphLayout,
  LocationGraphNode,
} from '@keres/shared/graphs/locationGraphLayout';

/**
 * The interactive drawing of the Location structure graph. The same architecture as the app's other
 * two graph canvases (story map, relation map): pan/zoom through `useCanvasViewport`, nodes as
 * absolutely positioned native Views, edges as react-native-svg `Path`s.
 *
 * The two edges have different styles so they can be told apart visually without a label on each one:
 * `contains` is a solid line (a hierarchy relation, parent->child), `connected_to` is dashed (a loose
 * spatial relation, with no direction).
 */

export type LocationGraphCanvasHandle = CanvasViewportHandle;

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
    const {
      containerRef,
      handleLayout,
      panHandlers,
      animatedTransform,
      width,
      height,
      svgOrigin,
      renderWindow,
    } = useCanvasViewport(ref, layout, { clampMode: 'free' });
    const visibleNodes = useMemo(
      () =>
        layout.nodes.filter((node) =>
          spatialRectIntersects(
            { x: node.x, y: node.y, width: node.width, height: node.height },
            renderWindow,
          ),
        ),
      [layout.nodes, renderWindow],
    );

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
      <GraphCanvasFrame
        containerRef={containerRef}
        handleLayout={handleLayout}
        panHandlers={panHandlers}
        animatedTransform={animatedTransform}
      >
        {width > 0 && height > 0 && (
          <Svg
            width={renderWindow.width}
            height={renderWindow.height}
            style={{ position: 'absolute', left: svgOrigin.x, top: svgOrigin.y }}
          >
            <G transform={`translate(${-svgOrigin.x} ${-svgOrigin.y})`}>
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
            </G>
          </Svg>
        )}

        {visibleNodes.map((node) => {
          const isSelected = node.id === selectedNodeId;
          const isHighlighted = highlightedNodeIds?.includes(node.id) ?? false;
          const borderColor =
            isSelected || isHighlighted
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
