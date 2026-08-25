import React, { useMemo } from 'react';
import { Animated, View } from 'react-native';
import type { usePanZoomCanvas } from '../../../../hooks/usePanZoomCanvas';
import { useTheme } from '../../../../theme';

type PanZoomCanvasResult = ReturnType<typeof usePanZoomCanvas>;

interface GraphCanvasFrameProps extends PanZoomCanvasResult {
  width: number;
  height: number;
  children: React.ReactNode;
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
}) => {
  const { colors } = useTheme();

  const styles = useMemo(
    () => ({
      container: {
        flex: 1 as const,
        overflow: 'hidden' as const,
        backgroundColor: colors.background,
      },
      content: {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        transformOrigin: 'top left' as const,
      },
    }),
    [colors],
  );

  return (
    <View ref={containerRef} style={styles.container} onLayout={handleLayout} {...panHandlers}>
      <Animated.View style={[styles.content, { width, height, transform: animatedTransform }]}>
        {children}
      </Animated.View>
    </View>
  );
};

export default GraphCanvasFrame;
