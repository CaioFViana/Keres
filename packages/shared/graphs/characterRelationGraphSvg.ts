import type {
  CharacterRelationGraphLayout,
  RelationGraphEdge,
} from './characterRelationGraphLayout';
import {
  MAP_HEADER_TOP,
  MAP_LEGEND_ROW_HEIGHT,
  MAP_MIN_CANVAS_WIDTH,
  renderDashedLegendEntry,
  renderEdgeLabelChip,
  renderMapTitle,
  renderRelationMapNode,
  renderSvgDocument,
  round,
  truncate,
} from './graphSvgShared';

/**
 * Serialises the relation map as a complete SVG file - the same reasoning as the story map
 * (`storyGraphSvg.ts`): SVG comes out whole regardless of the screen's zoom and opens readable at
 * any size, and the geometry arrives ready from `characterRelationGraphLayout`, so the interactive
 * screen and the exported file never disagree about where a character is.
 */

export interface CharacterRelationMapSvgOptions {
  title: string;
  /** Context line under the title (counts). */
  subtitle: string;
  showEdgeLabels: boolean;
  /** Characters drawn with an emphasised outline - the ones the focus filter selected. */
  highlightedNodeIds?: string[];
  labels: {
    isolated: string;
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

/** Average width of a character at 12px - only to size a label's background. */
const APPROX_CHAR_WIDTH = 6.2;

export function renderCharacterRelationMapSvg(
  layout: CharacterRelationGraphLayout,
  options: CharacterRelationMapSvgOptions,
): string {
  const canvasWidth = Math.max(layout.width, MAP_MIN_CANVAS_WIDTH);
  const hasIsolatedLegend = layout.isolatedCount > 0;
  const headerHeight = MAP_HEADER_TOP + 44 + (hasIsolatedLegend ? MAP_LEGEND_ROW_HEIGHT : 0) + 8;
  const totalHeight = headerHeight + layout.height;
  const highlightedIds = new Set(options.highlightedNodeIds ?? []);

  const body = [
    `<rect x="0" y="0" width="${canvasWidth}" height="${totalHeight}" fill="${options.colors.background}"/>`,
    renderHeader(options, hasIsolatedLegend),
    `<g transform="translate(0 ${round(headerHeight)})">`,
    // Edges first: passing under the nodes keeps a line from striking through a character's name.
    ...layout.edges.map((edge) => renderEdge(edge, options)),
    ...(options.showEdgeLabels ? layout.edges.map((edge) => renderEdgeLabel(edge, options)) : []),
    ...layout.nodes.map((node) =>
      renderRelationMapNode(node, node.height / 2, options.colors, highlightedIds),
    ),
    '</g>',
  ].join('\n');

  return renderSvgDocument(options.title, canvasWidth, totalHeight, body);
}

function renderHeader(options: CharacterRelationMapSvgOptions, hasIsolatedLegend: boolean): string {
  const parts = renderMapTitle(options.title, options.subtitle, options.colors);

  // The only possible legend item: the dashed stroke marks characters with no relation at all.
  // Unlike the story map (several chapters), there is never more than one line to draw here, so that
  // file's multi-line wrapping machinery does not apply.
  if (hasIsolatedLegend) {
    parts.push(
      renderDashedLegendEntry(
        MAP_HEADER_TOP + 44,
        options.labels.isolated,
        options.colors.textSecondary,
      ),
    );
  }

  return parts.join('\n');
}

function renderEdge(edge: RelationGraphEdge, options: CharacterRelationMapSvgOptions): string {
  return `<path d="${edge.path}" fill="none" stroke="${options.colors.border}" stroke-width="1.6" stroke-opacity="0.85"/>`;
}

function renderEdgeLabel(edge: RelationGraphEdge, options: CharacterRelationMapSvgOptions): string {
  const label = truncate(edge.label, 30);
  if (!label) return '';

  return renderEdgeLabelChip(label, edge.labelPosition, APPROX_CHAR_WIDTH, options.colors);
}
