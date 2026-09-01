import type { LocationMapContentType } from '@keres/shared';
import type {
  LocationMapConnection,
  LocationMapContains,
} from '@/src/components/features/location-maps/LocationMapCanvas';
import { interpolateColor, pointOnCircleBoundary } from './locationMapColors';
import { LOCATION_MAP_NODE_SIZE } from './locationMapLayout';
import { LOCATION_MAP_ICON_PATHS } from './locationMapIconPaths';

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

const NODE_RADIUS = LOCATION_MAP_NODE_SIZE / 2;
const LINE_END_MARGIN = 3;
const CONTAINS_DASH = '6 4';
const PADDING = 40;
/** Height reserved for the title/subtitle at the top of the exported file. */
const HEADER = 70;
/** Width of the contrast halo behind every line, so it stays visible over the image bases. */
const HALO_WIDTH = 6;
/** The ionicons viewBox is 512; this scale brings the icon to ~32px, inside the 44px circle. */
const ICON_SCALE = 1 / 16;

/** A triangle marking the arrow's tip, pointing along `angle` (radians). */
function arrowHeadPoints(tipX: number, tipY: number, angle: number, size: number): string {
  return [
    [tipX, tipY],
    [tipX - size * Math.cos(angle - 0.4), tipY - size * Math.sin(angle - 0.4)],
    [tipX - size * Math.cos(angle + 0.4), tipY - size * Math.sin(angle + 0.4)],
  ]
    .map((pair) => pair.map(round).join(','))
    .join(' ');
}

/**
 * Serialises a Location Map as a standalone SVG file. The drawing is normalised (nodes and images
 * dragged anywhere, even to negative coordinates, land inside the canvas), every line gets a
 * contrast halo so it reads over the image bases, and each point carries its icon (an ionicons
 * path) and its name.
 */
export function renderLocationMapSvg(
  content: LocationMapContentType,
  options: LocationMapSvgOptions,
): string {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const image of content.images) {
    minX = Math.min(minX, image.x);
    minY = Math.min(minY, image.y);
    maxX = Math.max(maxX, image.x + image.width);
    maxY = Math.max(maxY, image.y + image.height);
  }
  for (const node of content.nodes) {
    minX = Math.min(minX, node.x - NODE_RADIUS);
    minY = Math.min(minY, node.y - NODE_RADIUS);
    maxX = Math.max(maxX, node.x + NODE_RADIUS);
    maxY = Math.max(maxY, node.y + NODE_RADIUS + 18);
  }
  for (const marker of content.markers ?? []) {
    minX = Math.min(minX, marker.x - NODE_RADIUS);
    minY = Math.min(minY, marker.y - NODE_RADIUS);
    maxX = Math.max(maxX, marker.x + NODE_RADIUS);
    maxY = Math.max(maxY, marker.y + NODE_RADIUS + 18);
  }
  if (content.images.length === 0 && content.nodes.length === 0 && (content.markers?.length ?? 0) === 0) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }
  const offsetX = PADDING - minX;
  // The drawing starts below the reserved header, so an image base never covers the title.
  const offsetY = HEADER + PADDING - minY;
  const width = Math.max(560, maxX - minX + PADDING * 2);
  const height = Math.max(400, maxY - minY + PADDING * 2 + HEADER);

  const shift = (x: number, y: number) => ({ x: x + offsetX, y: y + offsetY });

  const byLocation = new Map<string, { x: number; y: number; color: string }>();
  for (const node of content.nodes) {
    byLocation.set(node.locationId, { x: node.x, y: node.y, color: node.color });
  }

  const imageElements = content.images.map((image) => {
    const p = shift(image.x, image.y);
    const uri = options.imageUris?.[image.galleryId];
    if (uri) {
      return `<image href="${uri}" x="${round(p.x)}" y="${round(p.y)}" width="${round(image.width)}" height="${round(image.height)}" preserveAspectRatio="xMidYMid slice"/>`;
    }
    return `<rect x="${round(p.x)}" y="${round(p.y)}" width="${round(image.width)}" height="${round(image.height)}" fill="${options.colors.surface}" stroke="${options.colors.border}"/>`;
  });

  // Every line is drawn twice: a thicker background-coloured halo first, then the coloured line,
  // so it stays visible over the image bases in either theme.
  const connectionElements = options.connections
    .filter(
      (connection) =>
        byLocation.has(connection.locationAId) && byLocation.has(connection.locationBId),
    )
    .flatMap((connection) => {
      const a = byLocation.get(connection.locationAId)!;
      const b = byLocation.get(connection.locationBId)!;
      const start = pointOnCircleBoundary(a, b, NODE_RADIUS + LINE_END_MARGIN);
      const end = pointOnCircleBoundary(b, a, NODE_RADIUS + LINE_END_MARGIN);
      const p1 = shift(start.x, start.y);
      const p2 = shift(end.x, end.y);
      const color = interpolateColor(a.color, b.color);
      return [
        `<path d="M ${round(p1.x)} ${round(p1.y)} L ${round(p2.x)} ${round(p2.y)}" fill="none" stroke="${options.colors.background}" stroke-width="${HALO_WIDTH}" stroke-opacity="0.9"/>`,
        `<path d="M ${round(p1.x)} ${round(p1.y)} L ${round(p2.x)} ${round(p2.y)}" fill="none" stroke="${color}" stroke-width="2" stroke-opacity="0.85"/>`,
      ];
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
      const p1 = shift(start.x, start.y);
      const p2 = shift(tip.x, tip.y);
      const color = interpolateColor(from.color, to.color);
      return [
        `<path d="M ${round(p1.x)} ${round(p1.y)} L ${round(p2.x)} ${round(p2.y)}" fill="none" stroke="${options.colors.background}" stroke-width="${HALO_WIDTH}" stroke-opacity="0.9"/>`,
        `<path d="M ${round(p1.x)} ${round(p1.y)} L ${round(p2.x)} ${round(p2.y)}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="${CONTAINS_DASH}" stroke-opacity="0.85"/>`,
        `<polygon points="${arrowHeadPoints(p2.x, p2.y, angle, 13)}" fill="${options.colors.background}"/>`,
        `<polygon points="${arrowHeadPoints(p2.x, p2.y, angle, 10)}" fill="${color}"/>`,
      ];
    });

  const nodeElements = content.nodes.map((node) => {
    const p = shift(node.x, node.y);
    const name = escapeXml(options.nodeNames[node.locationId] ?? node.locationId);
    const iconPaths = LOCATION_MAP_ICON_PATHS[node.icon] ?? '';
    const iconScale = ICON_SCALE;
    const iconSize = 512 * iconScale;
    const iconX = p.x - iconSize / 2;
    const iconY = p.y - iconSize / 2;
    return [
      `<circle cx="${round(p.x)}" cy="${round(p.y)}" r="${NODE_RADIUS}" fill="${options.colors.surface}" stroke="${escapeXml(node.color)}" stroke-width="2"/>`,
      iconPaths
        ? `<g transform="translate(${round(iconX)} ${round(iconY)}) scale(${iconScale})" fill="${escapeXml(node.color)}">${iconPaths}</g>`
        : '',
      // The name is drawn twice: a thick background-coloured stroke first (a halo), then the text,
      // so it stays readable over the image bases - the same treatment the lines got.
      `<text x="${round(p.x)}" y="${round(p.y + 8)}" font-size="10" font-weight="600" text-anchor="middle" fill="${options.colors.background}" stroke="${options.colors.background}" stroke-width="4" stroke-linejoin="round">${name}</text>`,
      `<text x="${round(p.x)}" y="${round(p.y + 8)}" font-size="10" font-weight="600" text-anchor="middle" fill="${options.colors.text}">${name}</text>`,
    ].join('');
  });
  const markerElements = (content.markers ?? []).map((marker) => {
    const p = shift(marker.x, marker.y);
    const name = escapeXml(marker.title);
    const iconPaths = LOCATION_MAP_ICON_PATHS[marker.icon] ?? '';
    const iconSize = 512 * ICON_SCALE;
    const iconX = p.x - iconSize / 2;
    const iconY = p.y - iconSize / 2;
    return [
      `<circle cx="${round(p.x)}" cy="${round(p.y)}" r="${NODE_RADIUS}" fill="${options.colors.surface}" stroke="${escapeXml(marker.color)}" stroke-width="2"/>`,
      iconPaths ? `<g transform="translate(${round(iconX)} ${round(iconY)}) scale(${ICON_SCALE})" fill="${escapeXml(marker.color)}">${iconPaths}</g>` : '',
      `<text x="${round(p.x)}" y="${round(p.y + 8)}" font-size="10" font-weight="600" text-anchor="middle" fill="${options.colors.background}" stroke="${options.colors.background}" stroke-width="4" stroke-linejoin="round">${name}</text>`,
      `<text x="${round(p.x)}" y="${round(p.y + 8)}" font-size="10" font-weight="600" text-anchor="middle" fill="${options.colors.text}">${name}</text>`,
    ].join('');
  });

  const body = [
    `<rect x="0" y="0" width="${round(width)}" height="${round(height)}" fill="${options.colors.background}"/>`,
    `<text x="24" y="28" font-size="20" font-weight="bold" fill="${options.colors.text}">${escapeXml(options.title)}</text>`,
    `<text x="24" y="46" font-size="11" fill="${options.colors.textSecondary}">${escapeXml(options.subtitle)}</text>`,
    `<g>`,
    ...imageElements,
    ...connectionElements,
    ...containsElements,
    ...nodeElements,
    ...markerElements,
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
