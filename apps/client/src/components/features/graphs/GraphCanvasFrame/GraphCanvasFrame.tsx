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
 * `StoryGraphCanvas`, `CharacterRelationGraphCanvas` e `LocationGraphCanvas` repetiam, byte a
 * byte, o mesmo encaixe do `usePanZoomCanvas` (`View`/`Animated.View` com `transformOrigin` e
 * `transform`) - pura estrutura, sem nenhuma lógica de domínio. Só essa parte sai daqui; a
 * renderização de dentro (arestas em SVG, estilo/cor/badge dos nós) continua em cada canvas,
 * que já é genuinamente diferente entre os três.
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
