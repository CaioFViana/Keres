import { DashPathEffect, Path } from '@shopify/react-native-skia';
import React, { forwardRef } from 'react';
import GraphCanvasFrame from '../GraphCanvasFrame/GraphCanvasFrame';
import GraphNodeBox from '../GraphNodeBox/GraphNodeBox';
import SkiaEdgeCanvas from '../SkiaEdgeCanvas/SkiaEdgeCanvas';
import SkiaOverlayErrorBoundary from '../SkiaEdgeCanvas/SkiaOverlayErrorBoundary';
import { polygonPointsToPath } from '../SkiaEdgeCanvas/polygonPointsToPath';
import type { CanvasViewportHandle } from '../../../../hooks/useCanvasViewport';
import { useGraphCanvasViewport } from '../../../../hooks/useGraphCanvasViewport';
import { useTheme } from '../../../../theme';
import type {
  LocationGraphLayout,
  LocationGraphNode,
} from '@keres/shared/graphs/locationGraphLayout';

/**
 * The interactive drawing of the Location structure graph. The same architecture as the app's other
 * two graph canvases (story map, relation map): pan/zoom through `useCanvasViewport`, nodes as
 * absolutely positioned native Views, edges as Skia paths in the shared viewport-sized overlay.
 *
 * The two edges have different styles so they can be told apart visually without a label on each one:
 * `contains` is a solid line (a hierarchy relation, parent->child), `connected_to` is dashed (a loose
 * spatial relation, with no direction). With a node selected, the lines that touch it are drawn
 * stronger and the rest fade back, like the nodes outside its neighbourhood.
 */

export type LocationGraphCanvasHandle = CanvasViewportHandle;

interface LocationGraphCanvasProps {
  layout: LocationGraphLayout;
  selectedNodeId: string | null;
  /** Locations the focus filter chose - drawn with the primary outline. */
  highlightedNodeIds?: string[];
  /** The selected node and its direct neighbours; everyone else fades. Null while nothing is selected. */
  focusNodeIds?: ReadonlySet<string> | null;
  /** For each folded place, how many places are folded into it: shown as a count on the node. */
  hiddenCounts?: ReadonlyMap<string, number>;
  /** What a screen reader says for a node (its name and how many relations it has). */
  nodeAccessibilityLabel: (node: LocationGraphNode) => string;
  /** Names the canvas as a region for a screen reader. */
  label?: string;
  onSelectNode: (node: LocationGraphNode) => void;
  /** A tap on empty canvas: the screen clears the focus. */
  onBackgroundTap?: () => void;
}

const LocationGraphCanvas = forwardRef<LocationGraphCanvasHandle, LocationGraphCanvasProps>(
  (
    {
      layout,
      selectedNodeId,
      highlightedNodeIds,
      focusNodeIds = null,
      hiddenCounts,
      nodeAccessibilityLabel,
      label,
      onSelectNode,
      onBackgroundTap,
    },
    ref,
  ) => {
    const { colors } = useTheme();
    const {
      containerRef,
      handleLayout,
      panHandlers,
      animatedTransform,
      cameraTransform,
      width,
      height,
      visibleNodes,
    } = useGraphCanvasViewport(ref, layout, onBackgroundTap && (() => onBackgroundTap()));

    const overlay =
      width > 0 && height > 0 ? (
        <SkiaOverlayErrorBoundary canvas="location-graph">
          <SkiaEdgeCanvas camera={cameraTransform}>
            {layout.edges.map((edge) => {
              const contains = edge.relationType === 'contains';
              const strong =
                !!selectedNodeId &&
                (edge.sourceId === selectedNodeId || edge.targetId === selectedNodeId);
              const color = contains ? colors.primary : colors.textSecondary;
              const opacity = selectedNodeId ? (strong ? 1 : 0.15) : contains ? 0.9 : 0.65;
              return (
                <React.Fragment key={edge.id}>
                  <Path
                    path={edge.path}
                    style="stroke"
                    color={color}
                    strokeWidth={(contains ? 1.8 : 1.4) + (strong ? 0.8 : 0)}
                    opacity={opacity}
                  >
                    {!contains && <DashPathEffect intervals={[6, 4]} />}
                  </Path>
                  {edge.arrow && (
                    <Path path={polygonPointsToPath(edge.arrow)} color={color} opacity={opacity} />
                  )}
                </React.Fragment>
              );
            })}
          </SkiaEdgeCanvas>
        </SkiaOverlayErrorBoundary>
      ) : null;

    return (
      <GraphCanvasFrame
        label={label}
        containerRef={containerRef}
        handleLayout={handleLayout}
        panHandlers={panHandlers}
        animatedTransform={animatedTransform}
        overlay={overlay}
      >
        {visibleNodes.map((node) => (
          <GraphNodeBox
            key={node.id}
            node={node}
            shape="box"
            selected={node.id === selectedNodeId}
            highlighted={highlightedNodeIds?.includes(node.id) ?? false}
            dimmed={!!focusNodeIds && !focusNodeIds.has(node.id)}
            accessibilityLabel={nodeAccessibilityLabel(node)}
            badge={hiddenCounts?.has(node.id) ? `+${hiddenCounts.get(node.id)}` : undefined}
            onPress={() => onSelectNode(node)}
          />
        ))}
      </GraphCanvasFrame>
    );
  },
);

LocationGraphCanvas.displayName = 'LocationGraphCanvas';

export default LocationGraphCanvas;
