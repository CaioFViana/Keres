import { useEffect, useState } from 'react';
import { ensureCanvasKit } from './canvasKitBoot';

/**
 * Web readiness: every Skia surface below this stays unmounted (`null`) until CanvasKit
 * boots, so the overlay degrades to "nodes now, edges when the WASM lands" instead of
 * throwing against an unbound `Skia` API. The entry normally boots CanvasKit before the
 * app graph evaluates; this covers the degraded path (boot timeout, mid-session retry).
 * A failed boot logs and keeps the edges hidden; the boundary above still contains any
 * later Skia-side failure.
 */
export function useCanvasKitReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    ensureCanvasKit().then(
      () => {
        if (!cancelled) setReady(true);
      },
      (error: unknown) => {
        console.error('[SkiaEdgeCanvas] CanvasKit failed to load; edge lines stay hidden.', error);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}
