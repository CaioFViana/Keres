/**
 * Converts an SVG `polygon` points string (`"x1,y1 x2,y2 …"`, the shape every layout in the app
 * emits) into an equivalent closed path `d`. Skia has no polygon drawing, so arrowheads cross
 * the port as filled paths; the pixels are identical.
 */
export function polygonPointsToPath(points: string): string {
  const pairs = points.trim().split(/\s+/).filter(Boolean);
  if (pairs.length === 0) return '';
  return `M ${pairs.join(' L ')} Z`;
}
