import React, { useEffect, useMemo } from 'react';
import { Animated, Platform, View } from 'react-native';
import type { useCanvasViewport } from '../../../../hooks/useCanvasViewport';
import { useTheme } from '../../../../theme';

type CanvasViewportResult = ReturnType<typeof useCanvasViewport>;

interface GraphCanvasFrameProps {
  children: React.ReactNode;
  containerRef: CanvasViewportResult['containerRef'];
  handleLayout: CanvasViewportResult['handleLayout'];
  panHandlers: CanvasViewportResult['panHandlers'];
  animatedTransform: CanvasViewportResult['animatedTransform'];
  /**
   * Content painted below the overlay (the location map's image bases: images < edges <
   * nodes). A second animated plane goes here when its content needs the camera; reuse
   * `graphCanvasPlaneStyle` so it matches the main plane exactly.
   */
  underlay?: React.ReactNode;
  /**
   * Viewport-sized overlay (the `SkiaEdgeCanvas`), rendered before the plane so nodes keep
   * painting above the edges. It must not carry an RN transform: the camera lives in its own
   * Skia `Group`, and a second transform here would double-apply it.
   */
  overlay?: React.ReactNode;
}

/**
 * The inner camera plane geometry, shared with `underlay` planes so all planes agree. Kept
 * deliberately free of `pointerEvents`: as a style key it is ignored on native and dropped as
 * invalid CSS on web, which leaves the full-size plane swallowing every hit aimed below it.
 * Every plane renders `pointerEvents="box-none"` as a real View prop instead - the prop carries
 * native semantics and react-native-web's `box-none` polyfill, so empty space falls through to
 * the layers below while pins/nodes still receive the hit.
 */
export const graphCanvasPlaneStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  transformOrigin: 'top left',
  overflow: 'visible',
} as const;

/**
 * The shared pan/zoom scaffolding of every canvas: an outer viewport that owns the gestures and
 * clips to the screen, and an inner plane that carries the camera transform.
 *
 * Children are world-addressed (`left`/`top` in drawing coordinates) and the inner plane is
 * viewport-sized with visible overflow, so panning and zooming only ever rewrite the container
 * transform - never a child's layout position, and never a document-sized native surface. The
 * only viewport-sized surfaces are the edges overlays each canvas draws for itself.
 */
/**
 * Attaches native-drag suppression to the container's host node on web, returning the detach
 * cleanup. Anything else - native platforms, a missing ref, or a host node without DOM
 * listeners (the test renderer) - attaches nothing and returns undefined.
 */
export function suppressNativeDragOnContainer(
  containerRef: { current: unknown },
  platformOS: typeof Platform.OS,
): (() => void) | undefined {
  if (platformOS !== 'web') return undefined;
  const node = containerRef.current as unknown as {
    addEventListener?: (
      type: string,
      listener: (event: { preventDefault: () => void }) => void,
    ) => void;
    removeEventListener?: (
      type: string,
      listener: (event: { preventDefault: () => void }) => void,
    ) => void;
  } | null;
  if (!node?.addEventListener || !node.removeEventListener) return undefined;
  const suppressNativeDrag = (event: { preventDefault: () => void }) => event.preventDefault();
  node.addEventListener('dragstart', suppressNativeDrag);
  return () => node.removeEventListener?.('dragstart', suppressNativeDrag);
}

const GraphCanvasFrame: React.FC<GraphCanvasFrameProps> = ({
  containerRef,
  handleLayout,
  panHandlers,
  animatedTransform,
  children,
  underlay,
  overlay,
}) => {
  const { colors } = useTheme();

  const styles = useMemo(
    () => ({
      container: {
        flex: 1 as const,
        overflow: 'hidden' as const,
        backgroundColor: colors.background,
        ...(Platform.OS === 'web'
          ? ({ userSelect: 'none', cursor: 'grab' } as Record<string, string>)
          : {}),
      },
      content: graphCanvasPlaneStyle,
    }),
    [colors],
  );

  // Native HTML5 drag would hijack image gestures (a ghost follows the cursor while the
  // responder system starves), and react-native-web drops the `onDragStart` prop, so the
  // suppression is a real DOM listener: `dragstart` bubbles here from any descendant image.
  useEffect(() => suppressNativeDragOnContainer(containerRef, Platform.OS), [containerRef]);

  return (
    <View ref={containerRef} style={styles.container} onLayout={handleLayout} {...panHandlers}>
      {underlay}
      {overlay}
      <Animated.View
        style={[styles.content, { transform: animatedTransform }]}
        pointerEvents="box-none"
      >
        {children}
      </Animated.View>
    </View>
  );
};

export default GraphCanvasFrame;
