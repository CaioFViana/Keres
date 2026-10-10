import { DashPathEffect, Path } from '@shopify/react-native-skia';
import { forwardRef } from 'react';
import GraphCanvasFrame from '../GraphCanvasFrame/GraphCanvasFrame';
import GraphNodeBox from '../GraphNodeBox/GraphNodeBox';
import SkiaEdgeCanvas from '../SkiaEdgeCanvas/SkiaEdgeCanvas';
import SkiaOverlayErrorBoundary from '../SkiaEdgeCanvas/SkiaOverlayErrorBoundary';
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
              const baseOpacity = contains ? 0.9 : 0.65;
              return (
                <Path
                  key={edge.id}
                  path={edge.path}
                  style="stroke"
                  color={contains ? colors.primary : colors.textSecondary}
                  strokeWidth={(contains ? 1.8 : 1.4) + (strong ? 0.8 : 0)}
                  opacity={selectedNodeId ? (strong ? 1 : 0.15) : baseOpacity}
                >
                  {!contains && <DashPathEffect intervals={[6, 4]} />}
                </Path>
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
            onPress={() => onSelectNode(node)}
          />
        ))}
      </GraphCanvasFrame>
    );
  },
);

LocationGraphCanvas.displayName = 'LocationGraphCanvas';

export default LocationGraphCanvas;
