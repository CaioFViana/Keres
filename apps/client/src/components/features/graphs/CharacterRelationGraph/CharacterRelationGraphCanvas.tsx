import { Path } from '@shopify/react-native-skia';
import { forwardRef } from 'react';
import GraphCanvasFrame from '../GraphCanvasFrame/GraphCanvasFrame';
import GraphNodeBox from '../GraphNodeBox/GraphNodeBox';
import SkiaEdgeCanvas from '../SkiaEdgeCanvas/SkiaEdgeCanvas';
import SkiaEdgeLabels from '../SkiaEdgeCanvas/SkiaEdgeLabels';
import SkiaOverlayErrorBoundary from '../SkiaEdgeCanvas/SkiaOverlayErrorBoundary';
import { useEdgeFont } from '../SkiaEdgeCanvas/useEdgeFont';
import type { CanvasViewportHandle } from '../../../../hooks/useCanvasViewport';
import { useGraphCanvasViewport } from '../../../../hooks/useGraphCanvasViewport';
import { useTheme } from '../../../../theme';
import { foldRelationType } from '@keres/shared/graphs/relationTypeColors';
import type {
  CharacterRelationGraphLayout,
  RelationGraphNode,
} from '@keres/shared/graphs/characterRelationGraphLayout';

/**
 * The interactive drawing of the character relations map.
 *
 * The same architecture as the story map (`StoryGraphCanvas`), including the pan/zoom
 * (`useCanvasViewport`, shared between the two). The edges here are just a straight segment
 * - the relation has no direction, so there is no arrow or curve to draw.
 *
 * With a node selected, its neighbourhood stays in full colour and the rest fades back: the lines
 * that touch it are drawn strong, the others barely there, and only its relation types are written.
 */

export type CharacterRelationGraphCanvasHandle = CanvasViewportHandle;

interface CharacterRelationGraphCanvasProps {
  layout: CharacterRelationGraphLayout;
  showEdgeLabels: boolean;
  selectedNodeId: string | null;
  /** Characters the focus filter chose - drawn with the primary outline. */
  highlightedNodeIds?: string[];
  /** The selected node and its direct neighbours; everyone else fades. Null while nothing is selected. */
  focusNodeIds?: ReadonlySet<string> | null;
  /** A colour for each kind of relation, keyed by `foldRelationType`; a kind without one is drawn in the border colour. */
  edgeColors?: ReadonlyMap<string, string>;
  /** What a screen reader says for a node (its name and how many relations it has). */
  nodeAccessibilityLabel: (node: RelationGraphNode) => string;
  /** Names the canvas as a region for a screen reader. */
  label?: string;
  onSelectNode: (node: RelationGraphNode) => void;
  /** A tap on empty canvas: the screen clears the focus. */
  onBackgroundTap?: () => void;
}

const CharacterRelationGraphCanvas = forwardRef<
  CharacterRelationGraphCanvasHandle,
  CharacterRelationGraphCanvasProps
>(
  (
    {
      layout,
      showEdgeLabels,
      selectedNodeId,
      highlightedNodeIds,
      focusNodeIds = null,
      edgeColors,
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
    // System font, like the `SvgText` labels before: the app bundles no font files.
    // System font on native, bundled Roboto on web; null while unavailable, where labels
    // are skipped.
    const edgeFont = useEdgeFont(10);

    const touchesSelection = (edge: { sourceId: string; targetId: string }) =>
      edge.sourceId === selectedNodeId || edge.targetId === selectedNodeId;
    // With a selection only its own relations are written: the labels of the rest would be noise.
    const labelledEdges = selectedNodeId ? layout.edges.filter(touchesSelection) : layout.edges;

    const overlay =
      width > 0 && height > 0 ? (
        <SkiaOverlayErrorBoundary canvas="character-relation">
          <SkiaEdgeCanvas camera={cameraTransform}>
            {layout.edges.map((edge) => {
              const strong = !!selectedNodeId && touchesSelection(edge);
              return (
                <Path
                  key={edge.id}
                  path={edge.path}
                  style="stroke"
                  color={
                    edgeColors?.get(foldRelationType(edge.label)) ??
                    (strong ? colors.primary : colors.border)
                  }
                  strokeWidth={strong ? 2.4 : 1.6}
                  opacity={selectedNodeId ? (strong ? 1 : 0.15) : 0.85}
                />
              );
            })}

            {showEdgeLabels && edgeFont && (
              <SkiaEdgeLabels edges={labelledEdges} font={edgeFont} maxChars={22} colors={colors} />
            )}
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
            shape="pill"
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

CharacterRelationGraphCanvas.displayName = 'CharacterRelationGraphCanvas';

export default CharacterRelationGraphCanvas;
