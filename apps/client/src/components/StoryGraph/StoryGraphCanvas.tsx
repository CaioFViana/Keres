import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { Animated, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path, Polygon, Rect as SvgRect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../theme';
import { GraphNode, StoryGraphLayout } from '../../utils/storyGraphLayout';

/**
 * Desenho interativo do mapa da história.
 *
 * Duas camadas sobre as mesmas coordenadas: as arestas em SVG (curva com ponta de seta é o
 * que SVG faz bem) e as cenas como Views nativas por cima. Os nós não são SVG de propósito -
 * como View eles ganham quebra de texto de verdade, `numberOfLines` e toque nativo, então
 * tocar numa cena não precisa de cálculo de acerto manual: o React Native já resolve isso,
 * inclusive com o mapa ampliado.
 *
 * Pan e zoom saem de `PanResponder`, e não de `react-native-gesture-handler`, porque o app
 * não monta `GestureHandlerRootView` na raiz - usar a biblioteca aqui exigiria mexer no
 * provedor de toda a aplicação por causa de uma tela.
 */

const MIN_SCALE = 0.15;
const MAX_SCALE = 2.5;
/** Movimento (em px) a partir do qual o gesto deixa de ser toque e passa a ser arraste. */
const DRAG_THRESHOLD = 5;
/** Sobra do "caber na tela" para o mapa não encostar nas bordas. */
const FIT_MARGIN = 0.94;

export interface StoryGraphCanvasHandle {
  fitToScreen(): void;
  zoomBy(factor: number): void;
}

interface StoryGraphCanvasProps {
  layout: StoryGraphLayout;
  showEdgeLabels: boolean;
  selectedNodeId: string | null;
  onSelectNode: (node: GraphNode) => void;
}

interface Transform {
  scale: number;
  x: number;
  y: number;
}

const StoryGraphCanvas = forwardRef<StoryGraphCanvasHandle, StoryGraphCanvasProps>(
  ({ layout, showEdgeLabels, selectedNodeId, onSelectNode }, ref) => {
    const { colors } = useTheme();

    const viewport = useRef({ width: 0, height: 0 });
    /** Canto do canvas na janela, para converter o foco da pinça em coordenadas locais. */
    const viewportOrigin = useRef({ x: 0, y: 0 });
    const containerRef = useRef<View>(null);

    const transform = useRef<Transform>({ scale: 1, x: 0, y: 0 });
    const animatedScale = useRef(new Animated.Value(1)).current;
    const animatedX = useRef(new Animated.Value(0)).current;
    const animatedY = useRef(new Animated.Value(0)).current;

    /** Estado do gesto em andamento; zerado a cada toque novo. */
    const gesture = useRef({ lastDx: 0, lastDy: 0, pinchDistance: 0, pinchScale: 1 });
    /** Identidade do último layout que já foi enquadrado, para não reenquadrar a cada render. */
    const fittedLayout = useRef<StoryGraphLayout | null>(null);

    const publish = useCallback(() => {
      animatedScale.setValue(transform.current.scale);
      animatedX.setValue(transform.current.x);
      animatedY.setValue(transform.current.y);
    }, [animatedScale, animatedX, animatedY]);

    /**
     * Mantém o mapa dentro da janela: quando ele é maior, não deixa arrastar até sair de
     * vista; quando é menor, centraliza. Sem isso é fácil "perder" o grafo e não achar mais.
     */
    const clamp = useCallback(() => {
      const { width: viewportWidth, height: viewportHeight } = viewport.current;
      if (viewportWidth === 0 || viewportHeight === 0) return;

      const scaledWidth = layout.width * transform.current.scale;
      const scaledHeight = layout.height * transform.current.scale;

      transform.current.x = scaledWidth <= viewportWidth
        ? (viewportWidth - scaledWidth) / 2
        : Math.min(0, Math.max(viewportWidth - scaledWidth, transform.current.x));

      transform.current.y = scaledHeight <= viewportHeight
        ? (viewportHeight - scaledHeight) / 2
        : Math.min(0, Math.max(viewportHeight - scaledHeight, transform.current.y));
    }, [layout.height, layout.width]);

    /** Aplica um zoom mantendo fixo o ponto do mapa que está sob `focus`. */
    const zoomAround = useCallback((nextScale: number, focus: { x: number; y: number }) => {
      const previous = transform.current.scale;
      const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
      if (clamped === previous) return;

      transform.current.x = focus.x - ((focus.x - transform.current.x) * clamped) / previous;
      transform.current.y = focus.y - ((focus.y - transform.current.y) * clamped) / previous;
      transform.current.scale = clamped;
      clamp();
      publish();
    }, [clamp, publish]);

    const fitToScreen = useCallback(() => {
      const { width: viewportWidth, height: viewportHeight } = viewport.current;
      if (viewportWidth === 0 || viewportHeight === 0 || layout.width === 0 || layout.height === 0) return;

      const scale = Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, Math.min(viewportWidth / layout.width, viewportHeight / layout.height) * FIT_MARGIN)
      );
      transform.current = {
        scale,
        x: (viewportWidth - layout.width * scale) / 2,
        y: (viewportHeight - layout.height * scale) / 2,
      };
      clamp();
      publish();
    }, [clamp, layout.height, layout.width, publish]);

    useImperativeHandle(ref, () => ({
      fitToScreen,
      zoomBy: (factor: number) => {
        zoomAround(transform.current.scale * factor, {
          x: viewport.current.width / 2,
          y: viewport.current.height / 2,
        });
      },
    }), [fitToScreen, zoomAround]);

    const handleLayout = useCallback(() => {
      containerRef.current?.measureInWindow((x, y, width, height) => {
        viewportOrigin.current = { x, y };
        viewport.current = { width, height };
        // Primeiro enquadramento só é possível quando se conhece o tamanho da janela, o que
        // acontece depois do primeiro render.
        if (fittedLayout.current !== layout) {
          fittedLayout.current = layout;
          fitToScreen();
        }
      });
    }, [fitToScreen, layout]);

    const panResponder = useMemo(
      () => PanResponder.create({
        // Não captura o início do toque: assim um toque simples chega ao nó e abre os
        // detalhes. O arraste é roubado do nó depois, na fase de captura do movimento.
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponderCapture: (event, gestureState) =>
          event.nativeEvent.touches.length > 1 ||
          Math.hypot(gestureState.dx, gestureState.dy) > DRAG_THRESHOLD,

        onPanResponderGrant: () => {
          gesture.current = { lastDx: 0, lastDy: 0, pinchDistance: 0, pinchScale: transform.current.scale };
        },

        onPanResponderMove: (event, gestureState) => {
          const touches = event.nativeEvent.touches;

          if (touches.length >= 2) {
            const [first, second] = touches;
            const distance = Math.hypot(first.pageX - second.pageX, first.pageY - second.pageY);
            const focus = {
              x: (first.pageX + second.pageX) / 2 - viewportOrigin.current.x,
              y: (first.pageY + second.pageY) / 2 - viewportOrigin.current.y,
            };

            if (gesture.current.pinchDistance === 0) {
              gesture.current.pinchDistance = distance;
              gesture.current.pinchScale = transform.current.scale;
            } else if (distance > 0) {
              zoomAround((gesture.current.pinchScale * distance) / gesture.current.pinchDistance, focus);
            }
            // Zera o arraste para o dedo que sai da pinça não dar um salto no mapa.
            gesture.current.lastDx = gestureState.dx;
            gesture.current.lastDy = gestureState.dy;
            return;
          }

          gesture.current.pinchDistance = 0;
          transform.current.x += gestureState.dx - gesture.current.lastDx;
          transform.current.y += gestureState.dy - gesture.current.lastDy;
          gesture.current.lastDx = gestureState.dx;
          gesture.current.lastDy = gestureState.dy;
          clamp();
          publish();
        },

        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: () => { gesture.current.pinchDistance = 0; },
        onPanResponderTerminate: () => { gesture.current.pinchDistance = 0; },
      }),
      [clamp, publish, zoomAround]
    );

    const styles = useMemo(() => StyleSheet.create({
      container: {
        flex: 1,
        overflow: 'hidden',
        backgroundColor: colors.background,
      },
      content: {
        position: 'absolute',
        top: 0,
        left: 0,
        // Escala e deslocamento medidos do canto: com a origem no centro (o padrão), manter um
        // ponto fixo sob os dedos exigiria compensar o tamanho do conteúdo a cada quadro.
        transformOrigin: 'top left',
      },
      node: {
        position: 'absolute',
        borderRadius: 10,
        overflow: 'hidden',
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
    }), [colors]);

    return (
      <View ref={containerRef} style={styles.container} onLayout={handleLayout} {...panResponder.panHandlers}>
        <Animated.View
          style={[
            styles.content,
            {
              width: layout.width,
              height: layout.height,
              transform: [
                { translateX: animatedX },
                { translateY: animatedY },
                { scale: animatedScale },
              ],
            },
          ]}
        >
          <Svg width={layout.width} height={layout.height}>
            {layout.edges.map(edge => {
              const isReturn = edge.kind === 'backward' || edge.kind === 'self';
              return (
                <React.Fragment key={edge.id}>
                  <Path
                    d={edge.path}
                    fill="none"
                    stroke={edge.color}
                    strokeWidth={1.8}
                    strokeOpacity={isReturn ? 0.9 : 0.7}
                    strokeDasharray={isReturn ? '7,5' : undefined}
                  />
                  <Polygon points={edge.arrowPoints} fill={edge.color} fillOpacity={isReturn ? 0.9 : 0.7} />
                </React.Fragment>
              );
            })}

            {showEdgeLabels && layout.edges.map(edge => {
              const label = edge.label.trim();
              if (!label) return null;
              const clipped = label.length > 26 ? `${label.slice(0, 25)}…` : label;
              const width = clipped.length * 6.4 + 10;
              return (
                <React.Fragment key={`label-${edge.id}`}>
                  <SvgRect
                    x={edge.labelPosition.x - width / 2}
                    y={edge.labelPosition.y - 8}
                    width={width}
                    height={16}
                    rx={4}
                    fill={colors.background}
                    fillOpacity={0.92}
                  />
                  <SvgText
                    x={edge.labelPosition.x}
                    y={edge.labelPosition.y + 4}
                    fontSize={10}
                    textAnchor="middle"
                    fill={colors.textSecondary}
                  >
                    {clipped}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>

          {layout.nodes.map(node => {
            const isSelected = node.id === selectedNodeId;
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
                  },
                ]}
              >
                <View style={[styles.nodeInner, { borderColor, borderWidth: isSelected || node.isStart || node.isFinish ? 2.5 : 1.2 }]}>
                  {node.labelLines.map((line, index) => (
                    <Text key={index} style={styles.nodeLabel} numberOfLines={1}>{line}</Text>
                  ))}
                  {!!node.chapterName && (
                    <Text style={[styles.nodeChapter, { color: node.chapterColor }]} numberOfLines={1}>
                      {node.chapterName}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      </View>
    );
  }
);

StoryGraphCanvas.displayName = 'StoryGraphCanvas';

export default StoryGraphCanvas;
