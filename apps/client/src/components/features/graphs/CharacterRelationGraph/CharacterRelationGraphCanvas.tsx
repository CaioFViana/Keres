import { Path } from '@shopify/react-native-skia';
import { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GraphCanvasFrame from '../GraphCanvasFrame/GraphCanvasFrame';
import SkiaEdgeCanvas from '../SkiaEdgeCanvas/SkiaEdgeCanvas';
import SkiaEdgeLabels from '../SkiaEdgeCanvas/SkiaEdgeLabels';
import SkiaOverlayErrorBoundary from '../SkiaEdgeCanvas/SkiaOverlayErrorBoundary';
import { useEdgeFont } from '../SkiaEdgeCanvas/useEdgeFont';
import type { CanvasViewportHandle } from '../../../../hooks/useCanvasViewport';
import { useGraphCanvasViewport } from '../../../../hooks/useGraphCanvasViewport';
import { useTheme } from '../../../../theme';
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
 */

export type CharacterRelationGraphCanvasHandle = CanvasViewportHandle;

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
  const {
    containerRef,
    handleLayout,
    panHandlers,
    animatedTransform,
    cameraTransform,
    width,
    height,
    visibleNodes,
  } = useGraphCanvasViewport(ref, layout);
  // System font, like the `SvgText` labels before: the app bundles no font files.
  // System font on native, bundled Roboto on web; null while unavailable, where labels
  // are skipped.
  const edgeFont = useEdgeFont(10);

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

  const overlay =
    width > 0 && height > 0 ? (
      <SkiaOverlayErrorBoundary canvas="character-relation">
        <SkiaEdgeCanvas camera={cameraTransform}>
          {layout.edges.map((edge) => (
            <Path
              key={edge.id}
              path={edge.path}
              style="stroke"
              color={colors.border}
              strokeWidth={1.6}
              opacity={0.85}
            />
          ))}

          {showEdgeLabels && edgeFont && (
            <SkiaEdgeLabels
              edges={layout.edges}
              font={edgeFont}
              maxChars={22}
              charWidth={6.2}
              colors={colors}
            />
          )}
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
});

CharacterRelationGraphCanvas.displayName = 'CharacterRelationGraphCanvas';

export default CharacterRelationGraphCanvas;
