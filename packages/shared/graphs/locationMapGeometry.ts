/** Parses a hex colour (`#RGB` or `#RRGGBB`) into channels. */
export function parseHexColor(value: string): { r: number; g: number; b: number } | null {
  const hex = (value ?? '').trim().replace('#', '');
  if (/^[0-9a-fA-F]{3}$/.test(hex))
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    };
  if (/^[0-9a-fA-F]{6}$/.test(hex))
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  return null;
}
export function interpolateColor(a: string, b: string): string {
  const pa = parseHexColor(a);
  const pb = parseHexColor(b);
  if (!pa || !pb) return '#9E9E9E';
  return `#${[Math.round((pa.r + pb.r) / 2), Math.round((pa.g + pb.g) / 2), Math.round((pa.b + pb.b) / 2)].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}
export function pointOnCircleBoundary(
  center: { x: number; y: number },
  towards: { x: number; y: number },
  radius: number,
): { x: number; y: number } {
  const dx = towards.x - center.x;
  const dy = towards.y - center.y;
  const scale = radius / (Math.hypot(dx, dy) || 1);
  return { x: center.x + dx * scale, y: center.y + dy * scale };
}
