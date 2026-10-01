import { tintIconShapes } from './mapIconSvg';

/**
 * Standalone `<svg>` markup for tinted Keres shapes, on the pack's 512 viewBox. Skia
 * parses it on native; the web wraps it in a data URI (`keresIconDataUri`), since
 * Skia's web SVG path cannot draw icons - see `MapIcon`.
 */
export function buildKeresSvgMarkup(shapes: string, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${tintIconShapes(shapes, color)}</svg>`;
}

/**
 * An `Image`-ready data URI for the tinted markup. The browser decodes it
 * synchronously, which is exactly what Skia's web SVG cannot do.
 */
export function keresIconDataUri(shapes: string, color: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildKeresSvgMarkup(shapes, color))}`;
}
