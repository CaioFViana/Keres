import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { Animated, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path, Rect as SvgRect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../theme';
import { CharacterRelationGraphLayout, RelationGraphNode } from '../../utils/characterRelationGraphLayout';

/**
 * Desenho interativo do mapa de relações entre personagens.
 *
 * Mesma arquitetura do mapa de história (`StoryGraphCanvas`): arestas em SVG por baixo,
 * personagens como Views nativas por cima (texto de verdade, toque nativo, sem cálculo de
 * acerto manual), pan/zoom via `PanResponder` porque o app não monta `GestureHandlerRootView`
 * na raiz. As arestas aqui são só um segmento reto - a relação não tem direção, então não há
 * seta nem curva a desenhar.
 */

const MIN_SCALE = 0.15;
const MAX_SCALE = 2.5;
const DRAG_THRESHOLD = 5;
const FIT_MARGIN = 0.94;

export interface CharacterRelationGraphCanvasHandle {
  fitToScreen(): void;
  zoomBy(factor: number): void;
}

interface CharacterRelationGraphCanvasProps {
  layout: CharacterRelationGraphLayout;
  showEdgeLabels: boolean;
  selectedNodeId: string | null;
  onSelectNode: (node: RelationGraphNode) => void;
}

interface Transform {
  scale: number;
  x: number;
  y: number;
}

const CharacterRelationGraphCanvas = forwardRef<CharacterRelationGraphCanvasHandle, CharacterRelationGraphCanvasProps>(
  ({ layout, showEdgeLabels, selectedNodeId, onSelectNode }, ref) => {
    const { colors } = useTheme();

    const viewport = useRef({ width: 0, height: 0 });
    const viewportOrigin = useRef({ x: 0, y: 0 });
    const containerRef = useRef<View>(null);

    const transform = useRef<Transform>({ scale: 1, x: 0, y: 0 });
    const animatedScale = useRef(new Animated.Value(1)).current;
    const animatedX = useRef(new Animated.Value(0)).current;
    const animatedY = useRef(new Animated.Value(0)).current;

    const gesture = useRef({ lastDx: 0, lastDy: 0, pinchDistance: 0, pinchScale: 1 });
    const fittedLayout = useRef<CharacterRelationGraphLayout | null>(null);

    const publish = useCallback(() => {
      animatedScale.setValue(transform.current.scale);
      animatedX.setValue(transform.current.x);
      animatedY.setValue(transform.current.y);
    }, [animatedScale, animatedX, animatedY]);

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
        if (fittedLayout.current !== layout) {
          fittedLayout.current = layout;
          fitToScreen();
        }
      });
    }, [fitToScreen, layout]);

    const panResponder = useMemo(
      () => PanResponder.create({
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
        transformOrigin: 'top left',
      },
      node: {
        position: 'absolute',
        borderRadius: 22,
        overflow: 'hidden',
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
            {layout.edges.map(edge => (
              <Path key={edge.id} d={edge.path} fill="none" stroke={colors.border} strokeWidth={1.6} strokeOpacity={0.85} />
            ))}

            {showEdgeLabels && layout.edges.map(edge => {
              const label = edge.label.trim();
              if (!label) return null;
              const clipped = label.length > 22 ? `${label.slice(0, 21)}…` : label;
              const width = clipped.length * 6.2 + 10;
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
            const borderColor = isSelected ? colors.primary : (node.isIsolated ? colors.textSecondary : colors.border);

            return (
              <TouchableOpacity
                key={node.id}
                activeOpacity={0.75}
                onPress={() => onSelectNode(node)}
                style={[styles.node, { left: node.x, top: node.y, width: node.width, height: node.height }]}
              >
                <View
                  style={[
                    styles.nodeInner,
                    node.isIsolated && styles.nodeInnerIsolated,
                    { borderColor, borderWidth: isSelected ? 2.5 : 1.2 },
                  ]}
                >
                  {node.labelLines.map((line, index) => (
                    <Text key={index} style={styles.nodeLabel} numberOfLines={1}>{line}</Text>
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      </View>
    );
  }
);

CharacterRelationGraphCanvas.displayName = 'CharacterRelationGraphCanvas';

export default CharacterRelationGraphCanvas;
