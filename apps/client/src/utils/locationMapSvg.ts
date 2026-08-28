import type { LocationMapContentType } from '@keres/shared';
import type { LocationMapConnection, LocationMapContains } from '@/src/components/features/location-maps/LocationMapCanvas';

export interface LocationMapSvgOptions {
  title: string;
  subtitle: string;
  colors: {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
  };
  /** Display names of the locations, keyed by location id. */
  nodeNames: Record<string, string>;
  /** Real `connected_to` relations, drawn as dashed lines. */
  connections: LocationMapConnection[];
  /** Real `contains` relations, drawn as directional sawtooth arrows (parent -> child). */
  contains: LocationMapContains[];
  /** Data URIs of the image bases, keyed by gallery id - embedded in the exported file. */
  imageUris?: Record<string, string>;
}

/** A map point's icon is an Ionicons glyph the SVG cannot render without the font - a coloured circle carries the identity instead. */
const NODE_RADIUS = 22;
const NODE_LABEL_Y = 8;
const CONNECTED_COLOR = '#9E9E9E';
const CONTAINS_COLOR = '#8BC34A';
const SAWTOOTH_AMPLITUDE = 7;
const SAWTOOTH_SEGMENTS = 6;
const PADDING = 40;

/** A sawtooth (zigzag) path between two points - the visual of a `contains` relation. */
function sawtoothPath(ax: number, ay: number, bx: number, by: number): string {
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  let d = `M ${round(ax)} ${round(ay)}`;
  for (let index = 1; index < SAWTOOTH_SEGMENTS; index += 1) {
    const t = index / SAWTOOTH_SEGMENTS;
    const side = index % 2 === 1 ? 1 : -1;
    d += ` L ${round(ax + dx * t + nx * SAWTOOTH_AMPLITUDE * side)} ${round(ay + dy * t + ny * SAWTOOTH_AMPLITUDE * side)}`;
  }
  return `${d} L ${round(bx)} ${round(by)}`;
}

/** A triangle marking the arrow's tip, pointing along `angle` (radians). */
function arrowHeadPoints(tipX: number, tipY: number, angle: number): string {
  const size = 10;
  return [
    [tipX, tipY],
    [tipX - size * Math.cos(angle - 0.4), tipY - size * Math.sin(angle - 0.4)],
    [tipX - size * Math.cos(angle + 0.4), tipY - size * Math.sin(angle + 0.4)],
  ]
    .map((pair) => pair.map(round).join(','))
    .join(' ');
}

/**
 * Serialises a Location Map as a standalone SVG file - the same reasoning as the board's export:
 * it comes out whole regardless of zoom, and the interactive screen and the exported file never
 * disagree about where a location point sits.
 */
export function renderLocationMapSvg(
  content: LocationMapContentType,
  options: LocationMapSvgOptions,
): string {
  let maxX = 0;
  let maxY = 0;
  for (const image of content.images) {
    maxX = Math.max(maxX, image.x + image.width);
    maxY = Math.max(maxY, image.y + image.height);
  }
  for (const node of content.nodes) {
    maxX = Math.max(maxX, node.x + NODE_RADIUS * 2);
    maxY = Math.max(maxY, node.y + NODE_RADIUS * 2 + NODE_LABEL_Y + 10);
  }
  const width = Math.max(560, maxX + PADDING * 2);
  const height = Math.max(400, maxY + PADDING * 2);

  const byLocation = new Map<string, { x: number; y: number }>();
  for (const node of content.nodes) {
    byLocation.set(node.locationId, { x: node.x, y: node.y });
  }

  const imageElements = content.images.map((image) => {
    const uri = options.imageUris?.[image.galleryId];
    if (uri) {
      return `<image href="${uri}" x="${round(image.x)}" y="${round(image.y)}" width="${round(image.width)}" height="${round(image.height)}" preserveAspectRatio="xMidYMid slice"/>`;
    }
    return `<rect x="${round(image.x)}" y="${round(image.y)}" width="${round(image.width)}" height="${round(image.height)}" fill="${options.colors.surface}" stroke="${options.colors.border}"/>`;
  });

  const connectionElements = options.connections
    .filter(
      (connection) =>
        byLocation.has(connection.locationAId) && byLocation.has(connection.locationBId),
    )
    .map((connection) => {
      const a = byLocation.get(connection.locationAId)!;
      const b = byLocation.get(connection.locationBId)!;
      return `<path d="M ${round(a.x)} ${round(a.y)} L ${round(b.x)} ${round(b.y)}" fill="none" stroke="${CONNECTED_COLOR}" stroke-width="2" stroke-dasharray="6 4" stroke-opacity="0.8"/>`;
    });

  const containsElements = options.contains
    .filter(
      (relation) =>
        byLocation.has(relation.parentLocationId) && byLocation.has(relation.childLocationId),
    )
    .flatMap((relation) => {
      const from = byLocation.get(relation.parentLocationId)!;
      const to = byLocation.get(relation.childLocationId)!;
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      return [
        `<path d="${sawtoothPath(from.x, from.y, to.x, to.y)}" fill="none" stroke="${CONTAINS_COLOR}" stroke-width="2" stroke-opacity="0.9"/>`,
        `<polygon points="${arrowHeadPoints(to.x, to.y, angle)}" fill="${CONTAINS_COLOR}"/>`,
      ];
    });

  const nodeElements = content.nodes.map((node) => {
    const name = escapeXml(options.nodeNames[node.locationId] ?? node.locationId);
    return [
      `<circle cx="${round(node.x)}" cy="${round(node.y)}" r="${NODE_RADIUS}" fill="${options.colors.surface}" stroke="${escapeXml(node.color)}" stroke-width="2"/>`,
      `<text x="${round(node.x)}" y="${round(node.y + NODE_LABEL_Y)}" font-size="10" font-weight="600" text-anchor="middle" fill="${options.colors.text}">${name}</text>`,
    ].join('');
  });

  const body = [
    `<rect x="0" y="0" width="${round(width)}" height="${round(height)}" fill="${options.colors.background}"/>`,
    `<text x="24" y="28" font-size="20" font-weight="bold" fill="${options.colors.text}">${escapeXml(options.title)}</text>`,
    `<text x="24" y="46" font-size="11" fill="${options.colors.textSecondary}">${escapeXml(options.subtitle)}</text>`,
    `<g transform="translate(${PADDING} ${PADDING})">`,
    ...imageElements,
    ...connectionElements,
    ...containsElements,
    ...nodeElements,
    '</g>',
  ].join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(width)}" height="${round(height)}" viewBox="0 0 ${round(width)} ${round(height)}" font-family="Helvetica, Arial, sans-serif">`,
    `<title>${escapeXml(options.title)}</title>`,
    body,
    '</svg>',
    '',
  ].join('\n');
}

function escapeXml(value: string): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}