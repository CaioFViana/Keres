import type { BoardContentType } from '@keres/shared';
import { getEntityAppearance } from '@keres/shared';
import { boardEdgeGeometry } from './boardEdges';
import {
  normalizeBoardCanvas,
  boardNodeSize,
  wrapNoteBody,
  noteBodyCharsPerLine,
  galleryHasImage,
  BOARD_GALLERY_IMAGE_HEIGHT,
  BOARD_NOTE_BODY_MAX_LINES,
  type BoardGalleryMediaById,
} from './boardLayout';
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
  /** Media of the story's galleries - sizes Gallery pins that show an image. */
  galleryMediaById?: BoardGalleryMediaById;
}

const HEADER = 56;

export function renderBoardSvg(content: BoardContentType, options: BoardSvgOptions): string {
  // Nodes are free to be dragged anywhere; the drawing is normalised so the whole board - even a
  // pin dragged to negative coordinates - always lands inside the exported canvas.
  const { offsetX, offsetY, width, height } = normalizeBoardCanvas(
    content.nodes,
    undefined,
    undefined,
    options.galleryMediaById,
  );
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
    return [boardEdgeGeometry(from, to, edge, options.galleryMediaById)];
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
      const galleryMedia =
        node.kind === 'entity' && node.entityType === 'Gallery'
          ? options.galleryMediaById?.[node.entityId]
          : undefined;
      const hasGalleryImage = galleryHasImage(galleryMedia);
      const size = boardNodeSize(node, galleryMedia);
      const bodyLines =
        node.kind === 'note' && node.body
          ? wrapNoteBody(node.body, BOARD_NOTE_BODY_MAX_LINES, noteBodyCharsPerLine(size.width))
          : [];
      // The exported file is standalone, so a gallery's picture is not embedded - the bigger card
      // stays, with a picture placeholder in the image area. The interactive board shows the image.
      const imagePlaceholder = hasGalleryImage
        ? [
            `<rect x="${round(node.x)}" y="${round(node.y)}" width="${size.width}" height="${BOARD_GALLERY_IMAGE_HEIGHT}" fill="${options.colors.surface}" stroke="${options.colors.border}"/>`,
            `<circle cx="${round(node.x + 78)}" cy="${round(node.y + 46)}" r="9" fill="${options.colors.textSecondary}"/>`,
            `<path d="M ${round(node.x + 118)} ${round(node.y + 96)} L ${round(node.x + 148)} ${round(node.y + 62)} L ${round(node.x + 178)} ${round(node.y + 96)} Z" fill="${options.colors.textSecondary}"/>`,
          ]
        : [];
      const titleY = hasGalleryImage ? node.y + BOARD_GALLERY_IMAGE_HEIGHT + 24 : node.y + 28;
      const typeY = hasGalleryImage ? node.y + BOARD_GALLERY_IMAGE_HEIGHT + 42 : node.y + 46;
      return [
        `<rect x="${round(node.x)}" y="${round(node.y)}" width="${size.width}" height="${size.height}" rx="10" fill="${fill}" stroke="${options.colors.border}"/>`,
        ...imagePlaceholder,
        `<rect x="${round(node.x)}" y="${round(node.y)}" width="5" height="${size.height}" rx="2" fill="${accent}"/>`,
        `<text x="${round(node.x + 14)}" y="${round(titleY)}" font-size="12" font-weight="600" fill="${options.colors.text}">${title}</text>`,
        `<text x="${round(node.x + 14)}" y="${round(typeY)}" font-size="10" fill="${options.colors.textSecondary}">${typeLabel}</text>`,
        ...bodyLines.map(
          (line, index) =>
            `<text x="${round(node.x + 14)}" y="${round(node.y + 64 + index * 13)}" font-size="11" fill="${options.colors.text}">${escapeXml(line)}</text>`,
        ),
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
