/**
 * Native readiness: the Skia JSI bindings install with the app, so every canvas can draw on
 * its first frame. The web twin (`useCanvasKitReady.web`) resolves CanvasKit (WASM) first;
 * Metro picks the file per platform, so native bundles never carry the loader.
 */
export function useCanvasKitReady(): boolean {
  return true;
}
