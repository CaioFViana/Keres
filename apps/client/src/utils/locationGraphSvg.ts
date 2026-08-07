import {
  GRAPH_PADDING,
  LocationGraphEdge,
  LocationGraphLayout,
  LocationGraphNode,
} from './locationGraphLayout';

/**
 * Serializa o grafo de estrutura de Locations como um arquivo SVG completo - mesmo raciocínio
 * dos outros dois mapas exportáveis (`storyGraphSvg.ts`, `characterRelationGraphSvg.ts`): sai
 * inteiro independente do zoom da tela, e a geometria vem pronta de `locationGraphLayout`, então
 * a tela interativa e o arquivo exportado nunca discordam sobre onde uma Location está.
 */

export interface LocationGraphSvgOptions {
  title: string;
  /** Linha de contexto sob o título (contagens). */
  subtitle: string;
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

const HEADER_TOP = 30;
const LEGEND_ROW_HEIGHT = 24;
const MIN_CANVAS_WIDTH = 560;

export function renderLocationGraphMapSvg(
  layout: LocationGraphLayout,
  options: LocationGraphSvgOptions
): string {
  const canvasWidth = Math.max(layout.width, MIN_CANVAS_WIDTH);
  const hasIsolatedLegend = layout.isolatedCount > 0;
  const hasContainsLegend = layout.edges.some(edge => edge.relationType === 'contains');
  const hasConnectedLegend = layout.edges.some(edge => edge.relationType === 'connected_to');
  const legendRows = [hasContainsLegend, hasConnectedLegend, hasIsolatedLegend].filter(Boolean).length;
  const headerHeight = HEADER_TOP + 44 + legendRows * LEGEND_ROW_HEIGHT + 8;
  const totalHeight = headerHeight + layout.height;

  const body = [
    `<rect x="0" y="0" width="${canvasWidth}" height="${totalHeight}" fill="${options.colors.background}"/>`,
    renderHeader(options, hasContainsLegend, hasConnectedLegend, hasIsolatedLegend),
    `<g transform="translate(0 ${round(headerHeight)})">`,
    // Arestas primeiro: passar por baixo dos nós evita que uma linha risque o nome da Location.
    ...layout.edges.map(edge => renderEdge(edge, options)),
    ...layout.nodes.map(node => renderNode(node, options)),
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

function renderHeader(options: LocationGraphSvgOptions, hasContainsLegend: boolean, hasConnectedLegend: boolean, hasIsolatedLegend: boolean): string {
  const parts = [
    `<text x="${GRAPH_PADDING}" y="${HEADER_TOP}" font-size="20" font-weight="bold" fill="${options.colors.text}">${escapeXml(options.title)}</text>`,
    `<text x="${GRAPH_PADDING}" y="${HEADER_TOP + 20}" font-size="11" fill="${options.colors.textSecondary}">${escapeXml(options.subtitle)}</text>`,
  ];

  let row = 0;
  const nextY = () => HEADER_TOP + 44 + row++ * LEGEND_ROW_HEIGHT;

  if (hasContainsLegend) {
    const y = nextY();
    parts.push(
      `<line x1="${GRAPH_PADDING}" y1="${round(y - 6)}" x2="${GRAPH_PADDING + 20}" y2="${round(y - 6)}" stroke="${options.colors.primary}" stroke-width="1.8"/>`,
      `<text x="${GRAPH_PADDING + 28}" y="${round(y)}" font-size="11" fill="${options.colors.textSecondary}">${escapeXml(options.labels.contains)}</text>`
    );
  }

  if (hasConnectedLegend) {
    const y = nextY();
    parts.push(
      `<line x1="${GRAPH_PADDING}" y1="${round(y - 6)}" x2="${GRAPH_PADDING + 20}" y2="${round(y - 6)}" stroke="${options.colors.textSecondary}" stroke-width="1.4" stroke-dasharray="4 3"/>`,
      `<text x="${GRAPH_PADDING + 28}" y="${round(y)}" font-size="11" fill="${options.colors.textSecondary}">${escapeXml(options.labels.connectedTo)}</text>`
    );
  }

  if (hasIsolatedLegend) {
    const y = nextY();
    parts.push(
      `<rect x="${GRAPH_PADDING}" y="${round(y - 11)}" width="12" height="12" rx="3" fill="none" stroke="${options.colors.textSecondary}" stroke-width="2" stroke-dasharray="3 2"/>`,
      `<text x="${GRAPH_PADDING + 18}" y="${round(y)}" font-size="11" fill="${options.colors.textSecondary}">${escapeXml(options.labels.isolated)}</text>`
    );
  }

  return parts.join('\n');
}

function renderEdge(edge: LocationGraphEdge, options: LocationGraphSvgOptions): string {
  const stroke = edge.relationType === 'contains' ? options.colors.primary : options.colors.textSecondary;
  const width = edge.relationType === 'contains' ? 1.8 : 1.4;
  const opacity = edge.relationType === 'contains' ? 0.9 : 0.65;
  const dash = edge.relationType === 'connected_to' ? ' stroke-dasharray="6 4"' : '';
  return `<path d="${edge.path}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-opacity="${opacity}"${dash}/>`;
}

function renderNode(node: LocationGraphNode, options: LocationGraphSvgOptions): string {
  const fill = node.isIsolated ? options.colors.surface : options.colors.primaryContainer;
  const dash = node.isIsolated ? ' stroke-dasharray="4 3"' : '';

  const parts = [
    `<rect x="${round(node.x)}" y="${round(node.y)}" width="${node.width}" height="${node.height}" rx="8" fill="${fill}" stroke="${options.colors.border}" stroke-width="1.2"${dash}/>`,
  ];

  const centerX = node.x + node.width / 2;
  const firstLineY = node.y + (node.labelLines.length > 1 ? node.height / 2 - 4 : node.height / 2 + 4);
  node.labelLines.forEach((line, index) => {
    parts.push(
      `<text x="${round(centerX)}" y="${round(firstLineY + index * 14)}" font-size="12" font-weight="600" text-anchor="middle" fill="${options.colors.text}">${escapeXml(line)}</text>`
    );
  });

  return parts.join('');
}

/**
 * Escapa o que quebraria o XML.
 *
 * Nome de Location é texto livre digitado pelo autor: um `&` ou um `<` tornaria o arquivo
 * inteiro inválido, e o erro só apareceria ao tentar abrir o mapa.
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
