import {
  DashPathEffect,
  Path,
  RoundedRect,
  Text as SkiaText,
} from '@shopify/react-native-skia';
import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GraphCanvasFrame from '../GraphCanvasFrame/GraphCanvasFrame';
import SkiaEdgeCanvas from '../SkiaEdgeCanvas/SkiaEdgeCanvas';
import SkiaOverlayErrorBoundary from '../SkiaEdgeCanvas/SkiaOverlayErrorBoundary';
import { measureEdgeLabelWidth } from '../SkiaEdgeCanvas/measureEdgeLabelWidth';
import { useEdgeFont } from '../SkiaEdgeCanvas/useEdgeFont';
import { polygonPointsToPath } from '../SkiaEdgeCanvas/polygonPointsToPath';
import type { CanvasViewportHandle } from '../../../../hooks/useCanvasViewport';
import { useCanvasViewport } from '../../../../hooks/useCanvasViewport';
import { useTheme } from '../../../../theme';
import { spatialRectIntersects } from '@keres/shared';
import type { GraphNode, StoryGraphLayout } from '@keres/shared/graphs/storyGraphLayout';

/**
 * The interactive drawing of the story map.
 *
 * Two layers over the same coordinates: the edges as Skia paths in the shared
 * viewport-sized overlay and the scenes as native Views on top. The nodes are deliberately not
 * drawings -
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
      cameraTransform,
      width,
      height,
      renderWindow,
    } = useCanvasViewport(ref, layout, { clampMode: 'free' });
    // System font, like the `SvgText` labels before: the app bundles no font files.
    // System font on native, bundled Roboto on web; null while unavailable, where
    // labels are skipped.
    const edgeFont = useEdgeFont(10);
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

    const overlay =
      width > 0 && height > 0 ? (
        <SkiaOverlayErrorBoundary canvas="story-graph">
          <SkiaEdgeCanvas camera={cameraTransform}>
            {layout.edges.map((edge) => {
              const isReturn = edge.kind === 'backward' || edge.kind === 'self';
            const opacity = isReturn ? 0.9 : 0.7;
            return (
              <React.Fragment key={edge.id}>
                <Path
                  path={edge.path}
                  style="stroke"
                  color={edge.color}
                  strokeWidth={1.8}
                  opacity={opacity}
                >
                  {isReturn && <DashPathEffect intervals={[7, 5]} />}
                </Path>
                <Path
                  path={polygonPointsToPath(edge.arrowPoints)}
                  color={edge.color}
                  opacity={opacity}
                />
              </React.Fragment>
            );
          })}

          {showEdgeLabels &&
            edgeFont &&
            layout.edges.map((edge) => {
              const label = edge.label.trim();
              if (!label) return null;
              const clipped = label.length > 26 ? `${label.slice(0, 25)}…` : label;
              const width = clipped.length * 6.4 + 10;
              // Skia has no `textAnchor`: center by measured width instead. Both place the
              // baseline at the same y.
              const textWidth = measureEdgeLabelWidth(edgeFont, clipped, 10);
              return (
                <React.Fragment key={`label-${edge.id}`}>
                  <RoundedRect
                    x={edge.labelPosition.x - width / 2}
                    y={edge.labelPosition.y - 8}
                    width={width}
                    height={16}
                    r={4}
                    color={colors.background}
                    opacity={0.92}
                  />
                  <SkiaText
                    x={edge.labelPosition.x - textWidth / 2}
                    y={edge.labelPosition.y + 4}
                    font={edgeFont}
                    text={clipped}
                    color={colors.textSecondary}
                  />
                </React.Fragment>
              );
            })}
          </SkiaEdgeCanvas>
        </SkiaOverlayErrorBoundary>
      ) : null;

    return (
      <GraphCanvasFrame
        containerRef={containerRef}
        handleLayout={handleLayout}
        panHandlers={panHandlers}
        animatedTransform={animatedTransform}
        overlay={overlay}
      >
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
