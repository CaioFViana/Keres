import { Asset } from 'expo-asset';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web/LoadSkiaWeb';
import wasmAssetId from 'canvaskit-wasm/bin/full/canvaskit.wasm';

let loadPromise: Promise<void> | null = null;

/**
 * Loads CanvasKit once per session and resolves when `global.CanvasKit` is usable. The
 * app entry awaits this BEFORE any `@shopify/react-native-skia` module evaluates: the
 * web `Skia` API binds `JsiSkApi(global.CanvasKit)` at import time, so a later load
 * cannot revive the stale binding - gating renders is not enough, boot order is the fix.
 *
 * The `.wasm` rides the Metro asset pipeline (see `assetExts` in `metro.config.js`), so
 * it is served in dev, exported with the web build, and always version-matched with the
 * glue - no CDN, no offline gap. `expo-asset` resolves the URI (its own registry-based
 * resolver works on web; `Image.resolveAssetSource` does not exist in react-native-web).
 * A failed load resets, so the next caller retries.
 */
export function ensureCanvasKit(): Promise<void> {
  if ((globalThis as { CanvasKit?: unknown }).CanvasKit !== undefined) return Promise.resolve();
  if (!loadPromise) {
    loadPromise = (async () => {
      const [asset] = await Asset.loadAsync(wasmAssetId);
      const uri = asset.localUri ?? asset.uri;
      if (!uri) throw new Error('canvaskit wasm asset resolved without a URI');
      await LoadSkiaWeb({ locateFile: () => uri });
    })();
    loadPromise.catch(() => {
      loadPromise = null;
    });
  }
  return loadPromise;
}
