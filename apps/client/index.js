/**
 * App entry. Web boots CanvasKit BEFORE any `@shopify/react-native-skia` module evaluates:
 * the web `Skia` API binds `JsiSkApi(global.CanvasKit)` at import time, so loading the WASM
 * after the graph loads leaves a permanently stale binding - render gating alone cannot fix
 * it. The graph below (`./src/App`) is required only once CanvasKit resolves.
 *
 * A failed or stalled boot (30s) still boots the app: canvases degrade to nodes without
 * edge lines via `useCanvasKitReady`, instead of wedging on the splash screen. Native
 * boots synchronously, exactly as before - the web loader never ships there (see the
 * platform split in `canvasKitBoot`). The serverless web build first makes the page
 * cross-origin isolated (`crossOriginIsolation`), which may cost one reload on a first visit.
 *
 * All real navigation is React Navigation (see src/navigation/AppNavigator.tsx); there is
 * no file-based routing, so the entry registers <App /> directly instead of going
 * through expo-router (which, as of SDK 56, hard-fails the bundler when it detects
 * react-navigation in the graph).
 */
const { Platform } = require('react-native');
const { registerRootComponent } = require('expo');

function boot() {
  const App = require('./src/App').default;
  registerRootComponent(App);
}

function bootWeb() {
  const {
    ensureCanvasKit,
  } = require('./src/components/features/graphs/SkiaEdgeCanvas/canvasKitBoot');
  const { promiseWithTimeout } = require('./src/utils/promiseWithTimeout');
  promiseWithTimeout(ensureCanvasKit(), 30000, 'CanvasKit boot').then(boot, (error) => {
    console.error('[SkiaEdgeCanvas] CanvasKit failed to load; booting without edge lines.', error);
    boot();
  });
}

if (Platform.OS !== 'web') {
  boot();
} else {
  // The serverless build (GitHub Pages) gets its COOP/COEP from a service worker, installed
  // before anything opens the database; everywhere else this resolves at once.
  const { ensureCrossOriginIsolation } = require('./src/utils/crossOriginIsolation');
  ensureCrossOriginIsolation().then((ready) => {
    if (ready) bootWeb();
  }, bootWeb);
}
