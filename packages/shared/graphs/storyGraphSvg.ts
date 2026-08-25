import type {
  GraphChapterLegendEntry,
  GraphEdge,
  GraphNode,
  StoryGraphLayout,
} from './storyGraphLayout';
import { GRAPH_PADDING } from './storyGraphLayout';

/**
 * Serialises the story map as a complete SVG file.
 *
 * SVG and not PNG on purpose. A story map grows far beyond the screen, and a screenshot only
 * captures what is visible - the author asked for the map "as a whole". SVG solves both sides: it
 * comes out whole, regardless of the zoom the screen was at, and being vector it opens readable at
 * any size (browser, image editor, print) with no aliasing.
 *
 * The geometry arrives ready from `storyGraphLayout`; here only appearance is decided, so the
 * interactive screen and the exported file never disagree about where a scene is.
 */

/** Colours and texts come from outside because this module knows neither theme nor language. */
export interface StoryMapSvgOptions {
  title: string;
  /** Context line under the title (counts, date). */
  subtitle: string;
  showEdgeLabels: boolean;
  labels: {
    start: string;
    finish: string;
    loops: string;
    detached: string;
  };
  colors: {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    accent: string;
    error: string;
  };
}

const HEADER_TOP = 30;
const LEGEND_ROW_HEIGHT = 24;
const LEGEND_GAP = 14;
const SWATCH_SIZE = 12;
/** Average width of a character at 12px - only to size label backgrounds and chips. */
const APPROX_CHAR_WIDTH = 6.4;
const MIN_CANVAS_WIDTH = 560;

export function renderStoryMapSvg(layout: StoryGraphLayout, options: StoryMapSvgOptions): string {
  const canvasWidth = Math.max(layout.width, MIN_CANVAS_WIDTH);
  const legend = buildLegendItems(layout, options);
  const legendRows = wrapLegendRows(legend, canvasWidth - GRAPH_PADDING * 2);
  const headerHeight = HEADER_TOP + 44 + legendRows.length * LEGEND_ROW_HEIGHT + 12;
  const totalHeight = headerHeight + layout.height;

  const body = [
    `<rect x="0" y="0" width="${canvasWidth}" height="${totalHeight}" fill="${options.colors.background}"/>`,
    renderHeader(options, canvasWidth, legendRows),
    `<g transform="translate(0 ${round(headerHeight)})">`,
    // Edges first: passing under the nodes keeps a curve from striking through the scene's text.
    ...layout.edges.map((edge) => renderEdge(edge)),
    ...(options.showEdgeLabels ? layout.edges.map((edge) => renderEdgeLabel(edge, options)) : []),
    ...layout.nodes.map((node) => renderNode(node, options)),
    '</g>',
  ].join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(canvasWidth)}" height="${round(totalHeight)}" viewBox="0 0 ${round(canvasWidth)} ${round(totalHeight)}" font-family="Helvetica, Arial, sans-serif">`,
    `<title>${escapeXml(options.title)}</title>`,
    body,
    '</svg>',
    '',
  ].join('\n');
}

interface LegendItem {
  label: string;
  color: string;
  /** A dashed stroke instead of a little square, for the entry of the returns. */
  style: 'swatch' | 'outline' | 'dashed';
  width: number;
}

function buildLegendItems(layout: StoryGraphLayout, options: StoryMapSvgOptions): LegendItem[] {
  const items: LegendItem[] = layout.chapters.map((chapter: GraphChapterLegendEntry) => ({
    label: `${chapter.name} (${chapter.sceneCount})`,
    color: chapter.color,
    style: 'swatch' as const,
    width: 0,
  }));

  items.push({
    label: options.labels.start,
    color: options.colors.accent,
    style: 'outline',
    width: 0,
  });
  items.push({
    label: options.labels.finish,
    color: options.colors.error,
    style: 'outline',
    width: 0,
  });
  if (layout.hasBackwardEdges) {
    items.push({
      label: options.labels.loops,
      color: options.colors.textSecondary,
      style: 'dashed',
      width: 0,
    });
  }
  if (layout.detachedSceneCount > 0) {
    items.push({
      label: options.labels.detached,
      color: options.colors.border,
      style: 'swatch',
      width: 0,
    });
  }

  for (const item of items) {
    item.width = SWATCH_SIZE + 6 + item.label.length * APPROX_CHAR_WIDTH;
  }
  return items;
}

function wrapLegendRows(items: LegendItem[], availableWidth: number): LegendItem[][] {
  const rows: LegendItem[][] = [];
  let current: LegendItem[] = [];
  let used = 0;

  for (const item of items) {
    const needed = item.width + (current.length > 0 ? LEGEND_GAP : 0);
    if (current.length > 0 && used + needed > availableWidth) {
      rows.push(current);
      current = [item];
      used = item.width;
      continue;
    }
    current.push(item);
    used += needed;
  }
  if (current.length > 0) rows.push(current);
  return rows;
}

function renderHeader(
  options: StoryMapSvgOptions,
  canvasWidth: number,
  legendRows: LegendItem[][],
): string {
  const parts = [
    `<text x="${GRAPH_PADDING}" y="${HEADER_TOP}" font-size="20" font-weight="bold" fill="${options.colors.text}">${escapeXml(options.title)}</text>`,
    `<text x="${GRAPH_PADDING}" y="${HEADER_TOP + 20}" font-size="11" fill="${options.colors.textSecondary}">${escapeXml(options.subtitle)}</text>`,
  ];

  legendRows.forEach((row, rowIndex) => {
    let x = GRAPH_PADDING;
    const y = HEADER_TOP + 44 + rowIndex * LEGEND_ROW_HEIGHT;
    for (const item of row) {
      parts.push(renderLegendItem(item, x, y, options));
      x += item.width + LEGEND_GAP;
    }
  });

  return parts.join('\n');
}

function renderLegendItem(
  item: LegendItem,
  x: number,
  y: number,
  options: StoryMapSvgOptions,
): string {
  const centerY = y - SWATCH_SIZE / 2 + 1;
  let mark: string;

  if (item.style === 'dashed') {
    mark = `<line x1="${x}" y1="${round(centerY + SWATCH_SIZE / 2)}" x2="${x + SWATCH_SIZE}" y2="${round(centerY + SWATCH_SIZE / 2)}" stroke="${item.color}" stroke-width="2" stroke-dasharray="4 3"/>`;
  } else if (item.style === 'outline') {
    mark = `<rect x="${x}" y="${round(centerY)}" width="${SWATCH_SIZE}" height="${SWATCH_SIZE}" rx="3" fill="none" stroke="${item.color}" stroke-width="2"/>`;
  } else {
    mark = `<rect x="${x}" y="${round(centerY)}" width="${SWATCH_SIZE}" height="${SWATCH_SIZE}" rx="3" fill="${item.color}"/>`;
  }

  return `${mark}<text x="${x + SWATCH_SIZE + 6}" y="${round(y + 2)}" font-size="11" fill="${options.colors.textSecondary}">${escapeXml(item.label)}</text>`;
}

function renderEdge(edge: GraphEdge): string {
  const isReturn = edge.kind === 'backward' || edge.kind === 'self';
  const dash = isReturn ? ' stroke-dasharray="7 5"' : '';
  const opacity = isReturn ? 0.85 : 0.7;

  return [
    `<path d="${edge.path}" fill="none" stroke="${edge.color}" stroke-width="1.8" stroke-opacity="${opacity}"${dash}/>`,
    `<polygon points="${edge.arrowPoints}" fill="${edge.color}" fill-opacity="${opacity}"/>`,
  ].join('');
}

function renderEdgeLabel(edge: GraphEdge, options: StoryMapSvgOptions): string {
  const label = truncate(edge.label, 28);
  if (!label) return '';

  const width = label.length * APPROX_CHAR_WIDTH + 10;
  const height = 15;
  const x = edge.labelPosition.x - width / 2;
  const y = edge.labelPosition.y - height / 2;

  return [
    // Fundo opaco: sem ele o texto some sobre a curva que ele descreve.
    `<rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${height}" rx="4" fill="${options.colors.background}" fill-opacity="0.92"/>`,
    `<text x="${round(edge.labelPosition.x)}" y="${round(edge.labelPosition.y + 4)}" font-size="10" text-anchor="middle" fill="${options.colors.textSecondary}">${escapeXml(label)}</text>`,
  ].join('');
}

function renderNode(node: GraphNode, options: StoryMapSvgOptions): string {
  const stroke = node.isStart
    ? options.colors.accent
    : node.isFinish
      ? options.colors.error
      : options.colors.border;
  const strokeWidth = node.isStart || node.isFinish ? 2.5 : 1.2;

  // A coloured rectangle behind and a background rectangle in front: what is left of the first one is
  // the chapter's band at the top, with the corners already rounded, needing no path or clip.
  const parts = [
    `<rect x="${round(node.x)}" y="${round(node.y)}" width="${node.width}" height="${node.height}" rx="10" fill="${node.chapterColor}"/>`,
    `<rect x="${round(node.x)}" y="${round(node.y + 5)}" width="${node.width}" height="${node.height - 5}" rx="9" fill="${options.colors.surface}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`,
  ];

  const centerX = node.x + node.width / 2;
  const firstLineY = node.y + (node.labelLines.length > 1 ? 30 : 38);
  node.labelLines.forEach((line, index) => {
    parts.push(
      `<text x="${round(centerX)}" y="${round(firstLineY + index * 15)}" font-size="12.5" font-weight="600" text-anchor="middle" fill="${options.colors.text}">${escapeXml(line)}</text>`,
    );
  });

  if (node.chapterName) {
    parts.push(
      `<text x="${round(centerX)}" y="${round(node.y + node.height - 9)}" font-size="9.5" text-anchor="middle" fill="${node.chapterColor}">${escapeXml(truncate(node.chapterName, 24))}</text>`,
    );
  }

  return parts.join('');
}

function truncate(value: string, maxChars: number): string {
  const normalized = (value ?? '').trim().replace(/\s+/g, ' ');
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars - 1)}…`;
}

/**
 * Escapes whatever would break the XML.
 *
 * A scene's title is free text typed by the author: an `&` or a `<` in a name would make the whole
 * file invalid, and the error would only show up when trying to open the map.
 */
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
