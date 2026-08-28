import type { LocationMapContentType } from '@keres/shared';
import type { LocationMapConnection, LocationMapContains } from '@/src/components/features/location-maps/LocationMapCanvas';
import { interpolateColor, pointOnCircleBoundary } from './locationMapColors';
import { LOCATION_MAP_NODE_SIZE } from './locationMapLayout';

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
  /** Real `connected_to` relations, drawn as solid lines. */
  connections: LocationMapConnection[];
  /** Real `contains` relations, drawn as dashed directional arrows (parent -> child). */
  contains: LocationMapContains[];
  /** Data URIs of the image bases, keyed by gallery id - embedded in the exported file. */
  imageUris?: Record<string, string>;
}

/** A map point's icon is an Ionicons glyph the SVG cannot render without the font - a coloured circle carries the identity instead. */
const NODE_RADIUS = LOCATION_MAP_NODE_SIZE / 2;
const LINE_END_MARGIN = 3;
const CONTAINS_DASH = '6 4';
const PADDING = 40;

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
    maxY = Math.max(maxY, node.y + NODE_RADIUS * 2 + 18);
  }
  const width = Math.max(560, maxX + PADDING * 2);
  const height = Math.max(400, maxY + PADDING * 2);

  const byLocation = new Map<string, { x: number; y: number; color: string }>();
  for (const node of content.nodes) {
    byLocation.set(node.locationId, { x: node.x, y: node.y, color: node.color });
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
      const start = pointOnCircleBoundary(a, b, NODE_RADIUS + LINE_END_MARGIN);
      const end = pointOnCircleBoundary(b, a, NODE_RADIUS + LINE_END_MARGIN);
      return `<path d="M ${round(start.x)} ${round(start.y)} L ${round(end.x)} ${round(end.y)}" fill="none" stroke="${interpolateColor(a.color, b.color)}" stroke-width="2" stroke-opacity="0.85"/>`;
    });

  const containsElements = options.contains
    .filter(
      (relation) =>
        byLocation.has(relation.parentLocationId) && byLocation.has(relation.childLocationId),
    )
    .flatMap((relation) => {
      const from = byLocation.get(relation.parentLocationId)!;
      const to = byLocation.get(relation.childLocationId)!;
      const start = pointOnCircleBoundary(from, to, NODE_RADIUS + LINE_END_MARGIN);
      const tip = pointOnCircleBoundary(to, from, NODE_RADIUS + LINE_END_MARGIN);
      const angle = Math.atan2(tip.y - start.y, tip.x - start.x);
      const color = interpolateColor(from.color, to.color);
      return [
        `<path d="M ${round(start.x)} ${round(start.y)} L ${round(tip.x)} ${round(tip.y)}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="${CONTAINS_DASH}" stroke-opacity="0.85"/>`,
        `<polygon points="${arrowHeadPoints(tip.x, tip.y, angle)}" fill="${color}"/>`,
      ];
    });

  const nodeElements = content.nodes.map((node) => {
    const name = escapeXml(options.nodeNames[node.locationId] ?? node.locationId);
    return [
      `<circle cx="${round(node.x)}" cy="${round(node.y)}" r="${NODE_RADIUS}" fill="${options.colors.surface}" stroke="${escapeXml(node.color)}" stroke-width="2"/>`,
      `<text x="${round(node.x)}" y="${round(node.y + 8)}" font-size="10" font-weight="600" text-anchor="middle" fill="${options.colors.text}">${name}</text>`,
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