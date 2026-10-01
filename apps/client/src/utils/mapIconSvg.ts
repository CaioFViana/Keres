import { resolveMapIcon } from '@keres/shared';
import { KERES_ICON_PATHS } from './keresIconPaths';
import { LOCATION_MAP_ICON_PATHS } from './locationMapIconPaths';
import { escapeSvgXml, roundSvg } from './svgExport';

/** Both icon packs are drawn on a 512×512 viewBox. */
const ICON_VIEWBOX = 512;

/**
 * Resolves the shapes for a stored map-icon name; never silently substitutes another icon.
 * Plain and `ion:` names look up the generated ionicons paths (older `-outline`/`-sharp`
 * picks fall back to the solid name); `keres:` names look up the vendored pack; unknown
 * namespaces resolve to nothing, so the point renders as a coloured circle only.
 */
function resolveMapIconShapes(iconName: string): string {
  const key = (iconName ?? '').trim();
  if (!key) return '';
  const resolved = resolveMapIcon(key);
  if (!resolved.glyph) return '';
  if (resolved.family === 'keres') return KERES_ICON_PATHS[resolved.glyph] ?? '';
  if (resolved.family !== 'ion') return '';
  if (LOCATION_MAP_ICON_PATHS[resolved.glyph]) return LOCATION_MAP_ICON_PATHS[resolved.glyph];
  // Older picks may have used outline/sharp variants; the map sheet stores the solid name.
  const solid = resolved.glyph.replace(/-outline$/, '').replace(/-sharp$/, '');
  return LOCATION_MAP_ICON_PATHS[solid] ?? '';
}

/**
 * Paints generated icon shapes with one color. Shared by the SVG export and the Skia
 * renderer so both surfaces draw identical artwork.
 */
export function tintIconShapes(shapes: string, color: string): string {
  const fill = escapeSvgXml(color);
  return shapes
    .replace(/\sfill="[^"]*"/g, '')
    .replace(/\stransform="[^"]*"/g, '')
    .replace(/<(path|circle|rect|polygon)\b([^>]*?)\s*\/>/g, `<$1$2 fill="${fill}"/>`);
}

/**
 * Draws a map point's own icon with fill + transform on every shape.
 *
 * Nested `<svg viewBox>` and parent-`<g fill>` both fail in some hosts (inherited fill dropped, or
 * every nested svg painted as the first). Per-shape attributes stay reliable, and we do not fall
 * back to the Location default (`map`) — that made every custom pick look identical in the export.
 */
export function renderMapIconSvg(
  iconName: string,
  cx: number,
  cy: number,
  color: string,
  pixelSize = 32,
): string {
  const shapes = resolveMapIconShapes(iconName);
  if (!shapes) return '';
  const scale = pixelSize / ICON_VIEWBOX;
  const x = roundSvg(cx - pixelSize / 2);
  const y = roundSvg(cy - pixelSize / 2);
  const transform = `translate(${x} ${y}) scale(${scale})`;
  return tintIconShapes(shapes, color).replace(
    /<(path|circle|rect|polygon)\b([^>]*?)\s*\/>/g,
    `<$1$2 transform="${transform}"/>`,
  );
}
