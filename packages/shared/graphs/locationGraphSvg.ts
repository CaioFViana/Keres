import type { LocationGraphEdge, LocationGraphLayout } from './locationGraphLayout';
import {
  MAP_HEADER_TOP,
  MAP_LEGEND_ROW_HEIGHT,
  MAP_MIN_CANVAS_WIDTH,
  escapeXml,
  renderDashedLegendEntry,
  renderMapTitle,
  renderRelationMapNode,
  renderSvgDocument,
  round,
} from './graphSvgShared';
import { GRAPH_PADDING } from './locationGraphLayout';

/**
 * Serialises the Location structure graph as a complete SVG file - the same reasoning as the
 * other two exportable maps (`storyGraphSvg.ts`, `characterRelationGraphSvg.ts`): it comes out
 * whole regardless of the screen's zoom, and the geometry arrives ready from
 * `locationGraphLayout`, so the interactive screen and the exported file never disagree about
 * where a Location is.
 */

export interface LocationGraphSvgOptions {
  title: string;
  /** Context line under the title (counts). */
  subtitle: string;
  /** Locations drawn with an emphasised outline - the ones the focus filter selected. */
  highlightedNodeIds?: string[];
  labels: {
    isolated: string;
    contains: string;
    connectedTo: string;
  };
  colors: {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    primaryContainer: string;
    primary: string;
  };
}

export function renderLocationGraphMapSvg(
  layout: LocationGraphLayout,
  options: LocationGraphSvgOptions,
): string {
  const canvasWidth = Math.max(layout.width, MAP_MIN_CANVAS_WIDTH);
  const hasIsolatedLegend = layout.isolatedCount > 0;
  const hasContainsLegend = layout.edges.some((edge) => edge.relationType === 'contains');
  const hasConnectedLegend = layout.edges.some((edge) => edge.relationType === 'connected_to');
  const legendRows = [hasContainsLegend, hasConnectedLegend, hasIsolatedLegend].filter(
    Boolean,
  ).length;
  const headerHeight = MAP_HEADER_TOP + 44 + legendRows * MAP_LEGEND_ROW_HEIGHT + 8;
  const totalHeight = headerHeight + layout.height;
  const highlightedIds = new Set(options.highlightedNodeIds ?? []);

  const body = [
    `<rect x="0" y="0" width="${canvasWidth}" height="${totalHeight}" fill="${options.colors.background}"/>`,
    renderHeader(options, hasContainsLegend, hasConnectedLegend, hasIsolatedLegend),
    `<g transform="translate(0 ${round(headerHeight)})">`,
    // Edges first: passing under the nodes keeps a line from striking through a Location's name.
    ...layout.edges.map((edge) => renderEdge(edge, options)),
    ...layout.nodes.map((node) => renderRelationMapNode(node, 8, options.colors, highlightedIds)),
    '</g>',
  ].join('\n');

  return renderSvgDocument(options.title, canvasWidth, totalHeight, body);
}

function renderHeader(
  options: LocationGraphSvgOptions,
  hasContainsLegend: boolean,
  hasConnectedLegend: boolean,
  hasIsolatedLegend: boolean,
): string {
  const parts = renderMapTitle(options.title, options.subtitle, options.colors);

  let row = 0;
  const nextY = () => MAP_HEADER_TOP + 44 + row++ * MAP_LEGEND_ROW_HEIGHT;

  if (hasContainsLegend) {
    const y = nextY();
    parts.push(
      `<line x1="${GRAPH_PADDING}" y1="${round(y - 6)}" x2="${GRAPH_PADDING + 20}" y2="${round(y - 6)}" stroke="${options.colors.primary}" stroke-width="1.8" stroke-dasharray="4 3"/>`,
      `<text x="${GRAPH_PADDING + 28}" y="${round(y)}" font-size="11" fill="${options.colors.textSecondary}">${escapeXml(options.labels.contains)}</text>`,
    );
  }

  if (hasConnectedLegend) {
    const y = nextY();
    parts.push(
      `<line x1="${GRAPH_PADDING}" y1="${round(y - 6)}" x2="${GRAPH_PADDING + 20}" y2="${round(y - 6)}" stroke="${options.colors.textSecondary}" stroke-width="1.4"/>`,
      `<text x="${GRAPH_PADDING + 28}" y="${round(y)}" font-size="11" fill="${options.colors.textSecondary}">${escapeXml(options.labels.connectedTo)}</text>`,
    );
  }

  if (hasIsolatedLegend) {
    parts.push(
      renderDashedLegendEntry(nextY(), options.labels.isolated, options.colors.textSecondary),
    );
  }

  return parts.join('\n');
}

function renderEdge(edge: LocationGraphEdge, options: LocationGraphSvgOptions): string {
  const stroke =
    edge.relationType === 'contains' ? options.colors.primary : options.colors.textSecondary;
  const width = edge.relationType === 'contains' ? 1.8 : 1.4;
  const opacity = edge.relationType === 'contains' ? 0.9 : 0.65;
  const dash = edge.relationType === 'contains' ? ' stroke-dasharray="6 4"' : '';
  const line = `<path d="${edge.path}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-opacity="${opacity}"${dash}/>`;
  if (!edge.arrow) return line;
  return `${line}\n<polygon points="${edge.arrow}" fill="${stroke}" fill-opacity="${opacity}"/>`;
}
