import React, { useMemo } from 'react';
import { Animated, Platform, View } from 'react-native';
import type { usePanZoomCanvas } from '../../../../hooks/usePanZoomCanvas';
import { useTheme } from '../../../../theme';

type PanZoomCanvasResult = ReturnType<typeof usePanZoomCanvas>;

interface GraphCanvasFrameProps {
  width: number;
  height: number;
  children: React.ReactNode;
  containerRef: PanZoomCanvasResult['containerRef'];
  handleLayout: PanZoomCanvasResult['handleLayout'];
  panHandlers: PanZoomCanvasResult['panHandlers'];
  animatedTransform: PanZoomCanvasResult['animatedTransform'];
  /**
   * Boards draw pins as views on top of an SVG. When a pin is dragged into the empty margin of a
   * centred drawing, the line must still paint. Other graphs stay clipped to the drawing box.
   */
  contentOverflow?: 'hidden' | 'visible';
}

/**
 * `StoryGraphCanvas`, `CharacterRelationGraphCanvas` and `LocationGraphCanvas` repeated, byte for
 * byte, the same `usePanZoomCanvas` scaffolding (`View`/`Animated.View` with `transformOrigin` and
 * `transform`) - pure structure, with no domain logic at all. Only that part comes out here; the
 * rendering inside (SVG edges, node style/colour/badge) stays in each canvas,
 * which is already genuinely different between the three.
 */
const GraphCanvasFrame: React.FC<GraphCanvasFrameProps> = ({
  width,
  height,
  containerRef,
  handleLayout,
  panHandlers,
  animatedTransform,
  children,
  contentOverflow = 'hidden',
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
        transformOrigin: 'top left' as const,
        overflow: contentOverflow,
        // Empty space belongs to the container's pan; pins/nodes still receive the hit.
        pointerEvents: 'box-none' as const,
      },
    }),
    [colors, contentOverflow],
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
      <Animated.View style={[styles.content, { width, height, transform: animatedTransform }]}>
        {children}
      </Animated.View>
    </View>
  );
};

export default GraphCanvasFrame;
