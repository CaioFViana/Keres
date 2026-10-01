/**
 * Native boot: the Skia JSI bindings install with the app, so there is nothing to await.
 * The web twin (`canvasKitBoot.web`) resolves CanvasKit (WASM) first; Metro picks the file
 * per platform, so native bundles never carry the loader or the `.wasm` asset.
 */
export function ensureCanvasKit(): Promise<void> {
  return Promise.resolve();
}
