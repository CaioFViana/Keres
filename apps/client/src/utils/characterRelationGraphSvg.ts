import {
  CharacterRelationGraphLayout,
  GRAPH_PADDING,
  RelationGraphEdge,
  RelationGraphNode,
} from './characterRelationGraphLayout';

/**
 * Serializa o mapa de relações como um arquivo SVG completo - mesmo raciocínio do mapa de
 * história (`storyGraphSvg.ts`): SVG sai inteiro independente do zoom da tela e abre legível
 * em qualquer tamanho, e a geometria vem pronta de `characterRelationGraphLayout`, então a
 * tela interativa e o arquivo exportado nunca discordam sobre onde um personagem está.
 */

export interface CharacterRelationMapSvgOptions {
  title: string;
  /** Linha de contexto sob o título (contagens). */
  subtitle: string;
  showEdgeLabels: boolean;
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
  };
}

const HEADER_TOP = 30;
const LEGEND_ROW_HEIGHT = 24;
/** Largura média de um caractere a 12px - só para dimensionar fundo de rótulo. */
const APPROX_CHAR_WIDTH = 6.2;
const MIN_CANVAS_WIDTH = 560;

export function renderCharacterRelationMapSvg(
  layout: CharacterRelationGraphLayout,
  options: CharacterRelationMapSvgOptions
): string {
  const canvasWidth = Math.max(layout.width, MIN_CANVAS_WIDTH);
  const hasIsolatedLegend = layout.isolatedCount > 0;
  const headerHeight = HEADER_TOP + 44 + (hasIsolatedLegend ? LEGEND_ROW_HEIGHT : 0) + 8;
  const totalHeight = headerHeight + layout.height;

  const body = [
    `<rect x="0" y="0" width="${canvasWidth}" height="${totalHeight}" fill="${options.colors.background}"/>`,
    renderHeader(options, hasIsolatedLegend),
    `<g transform="translate(0 ${round(headerHeight)})">`,
    // Arestas primeiro: passar por baixo dos nós evita que uma linha risque o nome do personagem.
    ...layout.edges.map(edge => renderEdge(edge, options)),
    ...(options.showEdgeLabels ? layout.edges.map(edge => renderEdgeLabel(edge, options)) : []),
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

function renderHeader(options: CharacterRelationMapSvgOptions, hasIsolatedLegend: boolean): string {
  const parts = [
    `<text x="${GRAPH_PADDING}" y="${HEADER_TOP}" font-size="20" font-weight="bold" fill="${options.colors.text}">${escapeXml(options.title)}</text>`,
    `<text x="${GRAPH_PADDING}" y="${HEADER_TOP + 20}" font-size="11" fill="${options.colors.textSecondary}">${escapeXml(options.subtitle)}</text>`,
  ];

  // Único item possível de legenda: o traço tracejado marca personagens sem nenhuma relação.
  // Diferente do mapa de história (vários capítulos), aqui nunca há mais de uma linha a
  // desenhar, então a máquina de quebrar em várias linhas daquele arquivo não se aplica.
  if (hasIsolatedLegend) {
    const y = HEADER_TOP + 44;
    parts.push(
      `<rect x="${GRAPH_PADDING}" y="${round(y - 11)}" width="12" height="12" rx="3" fill="none" stroke="${options.colors.textSecondary}" stroke-width="2" stroke-dasharray="3 2"/>`,
      `<text x="${GRAPH_PADDING + 18}" y="${round(y)}" font-size="11" fill="${options.colors.textSecondary}">${escapeXml(options.labels.isolated)}</text>`
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

  const width = label.length * APPROX_CHAR_WIDTH + 10;
  const height = 15;
  const x = edge.labelPosition.x - width / 2;
  const y = edge.labelPosition.y - height / 2;

  return [
    // Fundo opaco: sem ele o texto some sobre a linha que ele descreve.
    `<rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${height}" rx="4" fill="${options.colors.background}" fill-opacity="0.92"/>`,
    `<text x="${round(edge.labelPosition.x)}" y="${round(edge.labelPosition.y + 4)}" font-size="10" text-anchor="middle" fill="${options.colors.textSecondary}">${escapeXml(label)}</text>`,
  ].join('');
}

function renderNode(node: RelationGraphNode, options: CharacterRelationMapSvgOptions): string {
  const fill = node.isIsolated ? options.colors.surface : options.colors.primaryContainer;
  const dash = node.isIsolated ? ' stroke-dasharray="4 3"' : '';

  const parts = [
    `<rect x="${round(node.x)}" y="${round(node.y)}" width="${node.width}" height="${node.height}" rx="${node.height / 2}" fill="${fill}" stroke="${options.colors.border}" stroke-width="1.2"${dash}/>`,
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

function truncate(value: string, maxChars: number): string {
  const normalized = (value ?? '').trim().replace(/\s+/g, ' ');
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars - 1)}…`;
}

/**
 * Escapa o que quebraria o XML.
 *
 * Nome de personagem e tipo de relação são texto livre digitado pelo autor: um `&` ou um `<`
 * tornaria o arquivo inteiro inválido, e o erro só apareceria ao tentar abrir o mapa.
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
