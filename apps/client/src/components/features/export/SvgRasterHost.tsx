import { Canvas, ImageSVG, Skia, useCanvasRef } from '@shopify/react-native-skia';
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useCanvasKitReady } from '../graphs/SkiaEdgeCanvas/useCanvasKitReady';
import { useSvgRasterStore } from '../../../state/svgRasterStore';

/** First-frame grace: the remounted canvas has not drawn yet, so early reads go stale. */
const WARMUP_ATTEMPTS = 2;
/** ~0.5s of frames before a missing snapshot becomes an honest failure. */
const MAX_ATTEMPTS = 30;
const ATTEMPT_INTERVAL_MS = 16;

/**
 * The hidden raster canvas behind PNG exports. Mounted once near the app's root (`App.tsx`),
 * next to `AppAlertHost`: any screen awaits bytes through `rasterizeMapSvg` without mounting
 * anything locally, and the host renders nothing while idle.
 */
const SvgRasterHost: React.FC = () => {
  const job = useSvgRasterStore((state) => state.job);
  const canvasRef = useCanvasRef();
  // On web the job waits for the CanvasKit boot: parsing or snapshotting against the
  // unbound `Skia` API would only throw, and this host sits at the app root with no
  // boundary above it.
  const ready = useCanvasKitReady();
  const svgDom = useMemo(() => (job && ready ? Skia.SVG.MakeFromString(job.svg) : null), [job, ready]);

  useEffect(() => {
    if (!job || !ready) return;
    if (!svgDom) {
      useSvgRasterStore
        .getState()
        .failRaster(job.id, new Error('svg raster: could not parse the export SVG'));
      return;
    }
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      if (cancelled) return;
      attempts += 1;
      if (attempts > WARMUP_ATTEMPTS) {
        try {
          const bytes = canvasRef.current?.makeImageSnapshot()?.encodeToBytes();
          if (bytes && bytes.length > 0) {
            useSvgRasterStore.getState().finishRaster(job.id, bytes);
            return;
          }
        } catch {
          // A frame that is not ready yet reads as a throw or as empty bytes; the budgeted
          // retries below turn a canvas that never draws into an honest failure.
        }
      }
      if (attempts >= MAX_ATTEMPTS) {
        useSvgRasterStore
          .getState()
          .failRaster(job.id, new Error('svg raster: snapshot produced no bytes'));
        return;
      }
      timer = setTimeout(tick, ATTEMPT_INTERVAL_MS);
    };
    timer = setTimeout(tick, ATTEMPT_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [canvasRef, job, ready, svgDom]);

  if (!job || !ready || !svgDom) return null;
  // Touch-transparent wrapper, like the edges overlay: Skia's web view drops the
  // `pointerEvents` prop, so the bare canvas would swallow gestures for the split second
  // the job is mounted.
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas
        ref={canvasRef}
        key={job.id}
        style={{ position: 'absolute', width: job.width, height: job.height, opacity: 0 }}
        pointerEvents="none"
        collapsable={false}
      >
        <ImageSVG svg={svgDom} x={0} y={0} width={job.width} height={job.height} />
      </Canvas>
    </View>
  );
};

export default SvgRasterHost;
