import type { BoardContentType } from '@keres/shared';
import { getEntityAppearance } from '@keres/shared';
import { boardEdgeGeometry } from './boardEdges';
import { normalizeBoardCanvas, BOARD_NODE_HEIGHT, BOARD_NODE_WIDTH } from './boardLayout';
import { boardPinAppearanceType } from './boardPinAppearance';

export interface BoardSvgOptions {
  title: string;
  subtitle: string;
  colors: {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
  };
  titles: Record<
    string,
    { title: string; typeLabel: string; appearanceType?: string; ghost?: boolean }
  >;
}

const HEADER = 56;

export function renderBoardSvg(content: BoardContentType, options: BoardSvgOptions): string {
  // Nodes are free to be dragged anywhere; the drawing is normalised so the whole board - even a
  // pin dragged to negative coordinates - always lands inside the exported canvas.
  const { offsetX, offsetY, width, height } = normalizeBoardCanvas(content.nodes);
  const shiftedNodes = content.nodes.map((node) => ({
    ...node,
    x: node.x + offsetX,
    y: node.y + offsetY,
  }));
  const totalHeight = height + HEADER;
  const nodesById = new Map(shiftedNodes.map((node) => [node.id, node]));

  const edges = content.edges.flatMap((edge) => {
    const from = nodesById.get(edge.from);
    const to = nodesById.get(edge.to);
    if (!from || !to) return [];
    return [boardEdgeGeometry(from, to, edge)];
  });

  const body = [
    `<rect x="0" y="0" width="${round(width)}" height="${round(totalHeight)}" fill="${options.colors.background}"/>`,
    `<text x="24" y="28" font-size="20" font-weight="bold" fill="${options.colors.text}">${escapeXml(options.title)}</text>`,
    `<text x="24" y="46" font-size="11" fill="${options.colors.textSecondary}">${escapeXml(options.subtitle)}</text>`,
    `<g transform="translate(0 ${HEADER})">`,
    ...shiftedNodes.map((node) => {
      const meta = options.titles[node.id];
      const accent = getEntityAppearance(
        meta?.appearanceType ??
          boardPinAppearanceType(node.kind, node.kind === 'entity' ? node.entityType : undefined),
      ).color;
      const title = escapeXml(meta?.title ?? node.kind);
      const typeLabel = escapeXml(meta?.typeLabel ?? '');
      const fill = node.kind === 'note' ? options.colors.surface : options.colors.surface;
      return [
        `<rect x="${round(node.x)}" y="${round(node.y)}" width="${BOARD_NODE_WIDTH}" height="${BOARD_NODE_HEIGHT}" rx="10" fill="${fill}" stroke="${options.colors.border}"/>`,
        `<rect x="${round(node.x)}" y="${round(node.y)}" width="5" height="${BOARD_NODE_HEIGHT}" rx="2" fill="${accent}"/>`,
        `<text x="${round(node.x + 14)}" y="${round(node.y + 28)}" font-size="12" font-weight="600" fill="${options.colors.text}">${title}</text>`,
        `<text x="${round(node.x + 14)}" y="${round(node.y + 46)}" font-size="10" fill="${options.colors.textSecondary}">${typeLabel}</text>`,
      ].join('');
    }),
    ...edges.map((edge) => {
      const parts = [
        `<path d="${edge.path}" fill="none" stroke="${options.colors.text}" stroke-width="${edge.directed ? 2 : 1.6}"/>`,
      ];
      if (edge.directed) {
        parts.push(`<polygon points="${edge.arrow.points}" fill="${options.colors.text}"/>`);
      }
      if (edge.label) {
        parts.push(
          `<text x="${round(edge.labelX)}" y="${round(edge.labelY)}" font-size="11" text-anchor="middle" fill="${options.colors.text}">${escapeXml(edge.label)}</text>`,
        );
      }
      return parts.join('');
    }),
    '</g>',
  ].join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(width)}" height="${round(totalHeight)}" viewBox="0 0 ${round(width)} ${round(totalHeight)}" font-family="Helvetica, Arial, sans-serif">`,
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
