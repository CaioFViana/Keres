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
import type { BoardEntitySummary } from './boardEntitySummary';

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
    {
      title: string;
      typeLabel: string;
      appearanceType?: string;
      appearance?: { color: string };
      ghost?: boolean;
    }
  >;
  /** Media of the story's galleries - sizes Gallery pins that show an image. */
  galleryMediaById?: BoardGalleryMediaById;
  /** Data URIs of the pinned galleries' pictures, keyed by gallery id - embedded in the exported file. */
  galleryImages?: Record<string, string>;
  summaries?: Record<string, BoardEntitySummary | null>;
}

const HEADER = 56;
/** Approximate width of a character at 12px - only to size a title line. */
const TITLE_CHAR_WIDTH = 6.2;
/** Approximate width of a character at 10px - only to size a type label line. */
const TYPE_CHAR_WIDTH = 5.2;
/** Horizontal space a node's text can use: 12 left + 8 right padding, minus the 5px accent stripe. */
const NODE_TEXT_PADDING_X = 25;
/** Approximate width of a character at 11px - only to size an edge label. */
const EDGE_LABEL_CHAR_WIDTH = 6.2;

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

  // Match BoardCanvas paint order: edges under pins, so arrows never cover cards.
  const edgeElements = edges.map((edge) => {
    const parts = [
      `<path d="${edge.path}" fill="none" stroke="${options.colors.text}" stroke-width="${edge.directed ? 2 : 1.6}"/>`,
    ];
    if (edge.directed) {
      parts.push(`<polygon points="${edge.arrow.points}" fill="${options.colors.text}"/>`);
    }
    if (edge.label) {
      const label = truncate(edge.label, 30);
      const labelWidth = label.length * EDGE_LABEL_CHAR_WIDTH + 10;
      const labelHeight = 16;
      const x = edge.labelX - labelWidth / 2;
      const y = edge.labelY - labelHeight / 2;
      // An opaque background with a border: without it the text disappears over the line it
      // describes, and the exported file must stay readable anywhere.
      parts.push(
        `<rect x="${round(x)}" y="${round(y)}" width="${round(labelWidth)}" height="${labelHeight}" rx="4" fill="${options.colors.background}" fill-opacity="0.92" stroke="${options.colors.border}" stroke-width="1"/>`,
        `<text x="${round(edge.labelX)}" y="${round(edge.labelY + 4)}" font-size="11" text-anchor="middle" fill="${options.colors.text}">${escapeXml(label)}</text>`,
      );
    }
    return parts.join('');
  });

  const nodeElements = shiftedNodes.map((node) => {
    const meta = options.titles[node.id];
    const accent =
      meta?.appearance?.color ??
      getEntityAppearance(
        meta?.appearanceType ??
          boardPinAppearanceType(node.kind, node.kind === 'entity' ? node.entityType : undefined),
      ).color;
    const galleryMedia =
      node.kind === 'entity' && node.entityType === 'Gallery'
        ? options.galleryMediaById?.[node.entityId]
        : undefined;
    const hasGalleryImage = galleryHasImage(galleryMedia);
    const size = boardNodeSize(node, galleryMedia);
    const title = truncate(
      meta?.title ?? node.kind,
      Math.floor((size.width - NODE_TEXT_PADDING_X) / TITLE_CHAR_WIDTH),
    );
    const typeLabel = truncate(
      meta?.typeLabel ?? '',
      Math.floor((size.width - NODE_TEXT_PADDING_X) / TYPE_CHAR_WIDTH),
    );
    const fill = options.colors.surface;
    const bodyLines =
      node.kind === 'note' && node.body
        ? wrapNoteBody(node.body, BOARD_NOTE_BODY_MAX_LINES, noteBodyCharsPerLine(size.width))
        : [];
    const entityLines =
      node.kind === 'entity'
        ? [
            ...((node.displayMode === 'summary' || node.displayMode === 'summary-and-note') &&
            options.summaries?.[node.id]?.details
              ? wrapNoteBody(
                  options.summaries[node.id]?.details ?? '',
                  10,
                  noteBodyCharsPerLine(size.width),
                )
              : []),
            ...((node.displayMode === 'note' || node.displayMode === 'summary-and-note') &&
            node.cardNote
              ? wrapNoteBody(node.cardNote, 10, noteBodyCharsPerLine(size.width))
              : []),
          ]
        : [];
    // Gallery pins inset the picture like the on-screen card (padding 12/8/8) and clip to the
    // rounded frame so corners and the border stay visible.
    const galleryImage =
      hasGalleryImage && node.kind === 'entity'
        ? options.galleryImages?.[node.entityId]
        : undefined;
    const imageX = node.x + 12;
    const imageY = node.y + 8;
    const imageWidth = Math.max(0, size.width - 20);
    const clipId = `gallery-clip-${escapeXml(node.id)}`;
    const imageArea = hasGalleryImage
      ? [
          `<defs><clipPath id="${clipId}"><rect x="${round(imageX)}" y="${round(imageY)}" width="${round(imageWidth)}" height="${BOARD_GALLERY_IMAGE_HEIGHT}" rx="6"/></clipPath></defs>`,
          galleryImage
            ? `<image href="${galleryImage}" x="${round(imageX)}" y="${round(imageY)}" width="${round(imageWidth)}" height="${BOARD_GALLERY_IMAGE_HEIGHT}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`
            : [
                `<rect x="${round(imageX)}" y="${round(imageY)}" width="${round(imageWidth)}" height="${BOARD_GALLERY_IMAGE_HEIGHT}" rx="6" fill="${options.colors.surface}" stroke="${options.colors.border}"/>`,
                `<circle cx="${round(imageX + imageWidth / 2 - 20)}" cy="${round(imageY + 46)}" r="9" fill="${options.colors.textSecondary}"/>`,
                `<path d="M ${round(imageX + imageWidth / 2 + 10)} ${round(imageY + 96)} L ${round(imageX + imageWidth / 2 + 40)} ${round(imageY + 62)} L ${round(imageX + imageWidth / 2 + 70)} ${round(imageY + 96)} Z" fill="${options.colors.textSecondary}"/>`,
              ].join(''),
        ]
      : [];
    const titleY = hasGalleryImage ? imageY + BOARD_GALLERY_IMAGE_HEIGHT + 24 : node.y + 28;
    const typeY = hasGalleryImage ? imageY + BOARD_GALLERY_IMAGE_HEIGHT + 42 : node.y + 46;
    const detailBaseY = hasGalleryImage ? imageY + BOARD_GALLERY_IMAGE_HEIGHT + 60 : node.y + 64;
    return [
      `<rect x="${round(node.x)}" y="${round(node.y)}" width="${size.width}" height="${size.height}" rx="10" fill="${fill}"/>`,
      ...imageArea,
      hasGalleryImage
        ? ''
        : `<rect x="${round(node.x)}" y="${round(node.y)}" width="5" height="${size.height}" rx="2" fill="${accent}"/>`,
      `<text x="${round(node.x + 14)}" y="${round(titleY)}" font-size="12" font-weight="600" fill="${options.colors.text}">${escapeXml(title)}</text>`,
      `<text x="${round(node.x + 14)}" y="${round(typeY)}" font-size="10" fill="${options.colors.textSecondary}">${escapeXml(typeLabel)}</text>`,
      ...bodyLines.map(
        (line, index) =>
          `<text x="${round(node.x + 14)}" y="${round(node.y + 64 + index * 13)}" font-size="11" fill="${options.colors.text}">${escapeXml(line)}</text>`,
      ),
      ...entityLines.map(
        (line, index) =>
          `<text x="${round(node.x + 14)}" y="${round(detailBaseY + index * 13)}" font-size="11" fill="${escapeXml(index === 0 ? options.colors.text : options.colors.textSecondary)}">${escapeXml(line)}</text>`,
      ),
      // Stroke drawn last so the rounded frame stays visible over a full-bleed picture.
      `<rect x="${round(node.x)}" y="${round(node.y)}" width="${size.width}" height="${size.height}" rx="10" fill="none" stroke="${options.colors.border}" stroke-width="1"/>`,
    ].join('');
  });

  const body = [
    `<rect x="0" y="0" width="${round(width)}" height="${round(totalHeight)}" fill="${options.colors.background}"/>`,
    `<text x="24" y="28" font-size="20" font-weight="bold" fill="${options.colors.text}">${escapeXml(options.title)}</text>`,
    `<text x="24" y="46" font-size="11" fill="${options.colors.textSecondary}">${escapeXml(options.subtitle)}</text>`,
    `<g transform="translate(0 ${HEADER})">`,
    ...edgeElements,
    ...nodeElements,
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

/** Cuts a line of text so it stays inside the card, like the screen's single-line labels. */
function truncate(value: string, maxChars: number): string {
  const normalized = (value ?? '').trim().replace(/\s+/g, ' ');
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars - 1)}…`;
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
