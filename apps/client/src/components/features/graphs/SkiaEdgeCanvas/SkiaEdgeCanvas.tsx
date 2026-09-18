import { Canvas, Group } from '@shopify/react-native-skia';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import type { CanvasCameraTransform } from '../../../../hooks/useCanvasViewport';
import { useCanvasKitReady } from './useCanvasKitReady';

interface SkiaEdgeCanvasProps {
  /** Live camera from the viewport hook; the overlay tracks gestures with no React commit. */
  camera: SharedValue<CanvasCameraTransform>;
  children: React.ReactNode;
}

/**
 * The shared edges overlay of every pan/zoom canvas: a Skia canvas that fills the viewport and
 * draws its children - world-addressed edge paths - through the live camera.
 *
 * It renders as a sibling of the animated plane, never inside it: a canvas inside the scaled
 * plane would need world-unit layout to cover the visible window, rebuilding the giant bitmap
 * (now on the GPU) that crashed Android. Out here the framebuffer is always viewport-sized while
 * the `Group` reproduces the container mapping bit for bit, and edges stay vector-crisp at any
 * zoom because every frame redraws from the paths instead of stretching a bitmap.
 *
 * Paint order matches the old in-plane `<Svg>`: the frame renders this before the plane, so
 * nodes keep painting above the edges.
 *
 * On web the canvas stays unmounted until CanvasKit boots (`useCanvasKitReady`): rendering
 * against the unbound `Skia` API would only throw, so the overlay degrades to "nodes now,
 * edges when the WASM lands" instead of a black screen.
 *
 * The touch-transparent wrapper is load-bearing on web: Skia's web view drops the
 * `pointerEvents` prop, so a bare canvas would swallow every gesture aimed at the planes
 * below it (the map's image bases). The wrapper keeps the same geometry while letting
 * touches fall through on every platform.
 */
const SkiaEdgeCanvas: React.FC<SkiaEdgeCanvasProps> = ({ camera, children }) => {
  const ready = useCanvasKitReady();
  if (!ready) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Group transform={camera}>{children}</Group>
      </Canvas>
    </View>
  );
};

export default SkiaEdgeCanvas;
