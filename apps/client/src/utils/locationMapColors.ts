/** Parses a hex colour (`#RGB` or `#RRGGBB`) into channels, or null when it is not one. */
export function parseHexColor(value: string): { r: number; g: number; b: number } | null {
  const hex = (value ?? '').trim().replace('#', '');
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    };
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  return null;
}

/**
 * The colour halfway between two node colours, so a relation line reads as belonging to both ends
 * instead of a hardcoded grey. Falls back to grey when either colour cannot be parsed.
 */
export function interpolateColor(a: string, b: string): string {
  const pa = parseHexColor(a);
  const pb = parseHexColor(b);
  if (!pa || !pb) return '#9E9E9E';
  const r = Math.round((pa.r + pb.r) / 2);
  const g = Math.round((pa.g + pb.g) / 2);
  const blue = Math.round((pa.b + pb.b) / 2);
  return `#${[r, g, blue].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * A point on the border of a circle centred at `center`, in the direction of `towards` - where a
 * relation line should start/finish so it does not run underneath the node it points at.
 */
export function pointOnCircleBoundary(
  center: { x: number; y: number },
  towards: { x: number; y: number },
  radius: number,
): { x: number; y: number } {
  const dx = towards.x - center.x;
  const dy = towards.y - center.y;
  const length = Math.hypot(dx, dy) || 1;
  const scale = radius / length;
  return { x: center.x + dx * scale, y: center.y + dy * scale };
}
