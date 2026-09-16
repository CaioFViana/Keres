import React, { useMemo } from 'react';
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
}

/**
 * The shared pan/zoom scaffolding of every canvas: an outer viewport that owns the gestures and
 * clips to the screen, and an inner plane that carries the camera transform.
 *
 * Children are world-addressed (`left`/`top` in drawing coordinates) and the inner plane is
 * viewport-sized with visible overflow, so panning and zooming only ever rewrite the container
 * transform - never a child's layout position, and never a document-sized native surface. The
 * only viewport-sized surfaces are the edges overlays each canvas draws for itself.
 */
const GraphCanvasFrame: React.FC<GraphCanvasFrameProps> = ({
  containerRef,
  handleLayout,
  panHandlers,
  animatedTransform,
  children,
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
      content: {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        transformOrigin: 'top left' as const,
        overflow: 'visible' as const,
        // Empty space belongs to the container's pan; pins/nodes still receive the hit.
        pointerEvents: 'box-none' as const,
      },
    }),
    [colors],
  );

  return (
    <View
      ref={containerRef}
      style={styles.container}
      onLayout={handleLayout}
      {...panHandlers}
      {...(Platform.OS === 'web'
        ? {
            onDragStart: (event: { preventDefault?: () => void }) => event.preventDefault?.(),
          }
        : {})}
    >
      <Animated.View style={[styles.content, { transform: animatedTransform }]}>
        {children}
      </Animated.View>
    </View>
  );
};

export default GraphCanvasFrame;
