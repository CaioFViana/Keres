import { useSvgRasterStore } from '../state/svgRasterStore';

/** Longest side of an exported PNG: safe for every GPU texture, detailed enough to read. */
export const MAP_EXPORT_PNG_MAX_SIDE = 4096;

/**
 * Reads the standalone document size off the SVG root tag every export builder emits
 * (`width="…" height="…"`). `null` when the string is not one of ours - the PNG branch refuses
 * to guess rather than rasterize at a wrong aspect.
 */
export function parseSvgRootSize(svg: string): { width: number; height: number } | null {
  const root = svg.match(/<svg\b[^>]*>/);
  if (!root) return null;
  const width = root[0].match(/\swidth="([\d.]+)"/);
  const height = root[0].match(/\sheight="([\d.]+)"/);
  if (!width || !height) return null;
  const parsed = { width: Number(width[1]), height: Number(height[1]) };
  if (!Number.isFinite(parsed.width) || !Number.isFinite(parsed.height)) return null;
  if (parsed.width <= 0 || parsed.height <= 0) return null;
  return parsed;
}

/** Scales document units to raster pixels, capping the longest side; never below 1px. */
export function fitRasterSize(
  width: number,
  height: number,
  maxSide = MAP_EXPORT_PNG_MAX_SIDE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (!(longest > 0)) return { width: 1, height: 1 };
  const scale = Math.min(1, maxSide / longest);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Rewrites the builders' `font-family` fallback list to the single generic family for the
 * raster copy only (the SVG file keeps its bytes). Skia's native SVG renderer accepts the
 * fallback syntax but never falls back, so the list is where labels go to vanish; the
 * generic family resolves to the platform font.
 */
export function sanitizeSvgForRaster(svg: string): string {
  return svg.replaceAll(
    'font-family="Helvetica, Arial, sans-serif"',
    'font-family="sans-serif"',
  );
}

/** Swaps a `.svg` file name for its `.png` sibling; appends when there is no suffix. */
export function withPngExtension(fileName: string): string {
  return fileName.toLowerCase().endsWith('.svg')
    ? `${fileName.slice(0, -'.svg'.length)}.png`
    : `${fileName}.png`;
}

/**
 * Rasterizes a standalone export SVG to PNG bytes through the hidden canvas. Any screen can
 * await this without mounting anything - the host lives in `App.tsx`, next to `AppAlertHost`.
 */
export function rasterizeMapSvg(svg: string, width: number, height: number): Promise<Uint8Array> {
  return useSvgRasterStore.getState().requestRaster(svg, width, height);
}
