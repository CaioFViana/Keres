import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { G, Path, Polygon, Rect as SvgRect, Text as SvgText } from 'react-native-svg';
import GraphCanvasFrame from '../GraphCanvasFrame/GraphCanvasFrame';
import type { CanvasViewportHandle } from '../../../../hooks/useCanvasViewport';
import { useCanvasViewport } from '../../../../hooks/useCanvasViewport';
import { useTheme } from '../../../../theme';
import { spatialRectIntersects } from '@keres/shared';
import type { GraphNode, StoryGraphLayout } from '@keres/shared/graphs/storyGraphLayout';

/**
 * The interactive drawing of the story map.
 *
 * Two layers over the same coordinates: the edges in SVG (a curve with an arrowhead is what
 * SVG does well) and the scenes as native Views on top. The nodes are deliberately not SVG -
 * as a View they get real text wrapping, `numberOfLines` and native touch, so tapping a scene
 * needs no manual hit testing: React Native already solves that,
 * including with the map zoomed in.
 *
 * Pan and zoom come from `useCanvasViewport`, shared with every other canvas - see the
 * hook for why `PanResponder` instead of
 * `react-native-gesture-handler`.
 */

export type StoryGraphCanvasHandle = CanvasViewportHandle;

interface StoryGraphCanvasProps {
  layout: StoryGraphLayout;
  showEdgeLabels: boolean;
  selectedNodeId: string | null;
  onSelectNode: (node: GraphNode) => void;
  /** A screen-local Plot filter; it never changes the graph or its persistence. */
  highlightedNodeIds?: ReadonlySet<string>;
}

const StoryGraphCanvas = forwardRef<StoryGraphCanvasHandle, StoryGraphCanvasProps>(
  ({ layout, showEdgeLabels, selectedNodeId, onSelectNode, highlightedNodeIds }, ref) => {
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
            </G>
          </Svg>
        )}

        {visibleNodes.map((node) => {
          const isSelected = node.id === selectedNodeId;
          const isHighlighted = !highlightedNodeIds || highlightedNodeIds.has(node.id);
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
                  opacity: isHighlighted ? 1 : 0.28,
                },
              ]}
            >
              <View
                style={[
                  styles.nodeInner,
                  {
                    borderColor: isHighlighted && !isSelected ? colors.primary : borderColor,
                    borderWidth:
                      isSelected || node.isStart || node.isFinish || isHighlighted ? 2.5 : 1.2,
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
