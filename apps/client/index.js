/**
 * App entry. Web boots CanvasKit BEFORE any `@shopify/react-native-skia` module evaluates:
 * the web `Skia` API binds `JsiSkApi(global.CanvasKit)` at import time, so loading the WASM
 * after the graph loads leaves a permanently stale binding - render gating alone cannot fix
 * it. The graph below (`expo-router/entry`) is required only once CanvasKit resolves.
 *
 * A failed or stalled boot (30s) still boots the app: canvases degrade to nodes without
 * edge lines via `useCanvasKitReady`, instead of wedging on the splash screen. Native
 * boots synchronously, exactly as before - the web loader never ships there (see the
 * platform split in `canvasKitBoot`).
 */
const { Platform } = require('react-native');

if (Platform.OS !== 'web') {
  require('expo-router/entry');
} else {
  const {
    ensureCanvasKit,
  } = require('./src/components/features/graphs/SkiaEdgeCanvas/canvasKitBoot');
  const { promiseWithTimeout } = require('./src/utils/promiseWithTimeout');
  promiseWithTimeout(ensureCanvasKit(), 30000, 'CanvasKit boot').then(
    () => require('expo-router/entry'),
    (error) => {
      console.error(
        '[SkiaEdgeCanvas] CanvasKit failed to load; booting without edge lines.',
        error,
      );
      require('expo-router/entry');
    },
  );
}
