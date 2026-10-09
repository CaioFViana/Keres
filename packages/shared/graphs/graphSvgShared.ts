import type { GraphPoint } from './storyGraphLayout';
import { GRAPH_PADDING } from './storyGraphLayout';

/**
 * Pieces every exported map file is built from (story map, character relation map, location map):
 * the document wrapper, the title block, the text escaping and the parts drawn the same way on
 * the relation maps. Only appearance lives here - the geometry always comes from the layout.
 */

export const MAP_HEADER_TOP = 30;
export const MAP_LEGEND_ROW_HEIGHT = 24;
export const MAP_MIN_CANVAS_WIDTH = 560;

export interface MapSvgTextColors {
  text: string;
  textSecondary: string;
}

export function renderSvgDocument(
  title: string,
  width: number,
  height: number,
  body: string,
): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(width)}" height="${round(height)}" viewBox="0 0 ${round(width)} ${round(height)}" font-family="Helvetica, Arial, sans-serif">`,
    `<title>${escapeXml(title)}</title>`,
    body,
    '</svg>',
    '',
  ].join('\n');
}

/** The title and the context line under it, as the first two parts of a map's header. */
export function renderMapTitle(
  title: string,
  subtitle: string,
  colors: MapSvgTextColors,
): string[] {
  return [
    `<text x="${GRAPH_PADDING}" y="${MAP_HEADER_TOP}" font-size="20" font-weight="bold" fill="${colors.text}">${escapeXml(title)}</text>`,
    `<text x="${GRAPH_PADDING}" y="${MAP_HEADER_TOP + 20}" font-size="11" fill="${colors.textSecondary}">${escapeXml(subtitle)}</text>`,
  ];
}

/**
 * A legend entry for "no relation at all": a dashed box and its text. Relation maps only - the
 * story map's legend marks its own entries.
 */
export function renderDashedLegendEntry(y: number, label: string, color: string): string {
  return [
    `<rect x="${GRAPH_PADDING}" y="${round(y - 11)}" width="12" height="12" rx="3" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="3 2"/>`,
    `<text x="${GRAPH_PADDING + 18}" y="${round(y)}" font-size="11" fill="${color}">${escapeXml(label)}</text>`,
  ].join('\n');
}

/**
 * The label of an edge on an opaque chip. `label` is already truncated and non-empty; `charWidth`
 * is the average width of a character at 10px - only to size the chip.
 */
export function renderEdgeLabelChip(
  label: string,
  position: GraphPoint,
  charWidth: number,
  colors: { background: string; textSecondary: string },
): string {
  const width = label.length * charWidth + 10;
  const height = 15;
  const x = position.x - width / 2;
  const y = position.y - height / 2;

  return [
    // An opaque background: without it the text disappears over the line it describes.
    `<rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${height}" rx="4" fill="${colors.background}" fill-opacity="0.92"/>`,
    `<text x="${round(position.x)}" y="${round(position.y + 4)}" font-size="10" text-anchor="middle" fill="${colors.textSecondary}">${escapeXml(label)}</text>`,
  ].join('');
}

export interface RelationMapNodeShape {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  labelLines: string[];
  isIsolated: boolean;
}

export interface RelationMapNodeColors {
  surface: string;
  primaryContainer: string;
  border: string;
  primary: string;
  text: string;
}

/**
 * A character or location as a rounded box with its label lines centred in it. `rx` is the corner
 * radius, which the two relation maps set differently.
 */
export function renderRelationMapNode(
  node: RelationMapNodeShape,
  rx: number,
  colors: RelationMapNodeColors,
  highlightedIds: Set<string>,
): string {
  const fill = node.isIsolated ? colors.surface : colors.primaryContainer;
  const dash = node.isIsolated ? ' stroke-dasharray="4 3"' : '';
  const highlighted = highlightedIds.has(node.id);
  // The focused nodes keep their own outline (same as the interactive canvas), so the exported
  // file shows the same selection the screen does.
  const stroke = highlighted ? colors.primary : colors.border;
  const strokeWidth = highlighted ? 2.5 : 1.2;

  const parts = [
    `<rect x="${round(node.x)}" y="${round(node.y)}" width="${node.width}" height="${node.height}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${dash}/>`,
  ];

  const centerX = node.x + node.width / 2;
  const firstLineY =
    node.y + (node.labelLines.length > 1 ? node.height / 2 - 4 : node.height / 2 + 4);
  node.labelLines.forEach((line, index) => {
    parts.push(
      `<text x="${round(centerX)}" y="${round(firstLineY + index * 14)}" font-size="12" font-weight="600" text-anchor="middle" fill="${colors.text}">${escapeXml(line)}</text>`,
    );
  });

  return parts.join('');
}

/** Shortens free text to `maxChars`, collapsing whitespace, with an ellipsis when it had to. */
export function truncate(value: string, maxChars: number): string {
  const normalized = (value ?? '').trim().replace(/\s+/g, ' ');
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars - 1)}…`;
}

/**
 * Escapes whatever would break the XML.
 *
 * A name or a relation type is free text typed by the author: an `&` or a `<` would make the
 * whole file invalid, and the error would only show up when trying to open the map.
 */
export function escapeXml(value: string): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function round(value: number): number {
  return Math.round(value * 100) / 100;
}
