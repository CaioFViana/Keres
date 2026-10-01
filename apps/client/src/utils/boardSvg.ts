import type { BoardContentType } from '@keres/shared';
import { getEntityAppearance } from '@keres/shared';
import { boardEdgeGeometry } from './boardEdges';
import { canvasOverlayExportBounds, renderCanvasOverlaySvg } from './canvasOverlaySvg';
import {
  normalizeBoardCanvas,
  boardNodeSize,
  wrapNoteBody,
  noteBodyCharsPerLine,
  galleryHasImage,
  BOARD_NOTE_BODY_MAX_LINES,
  type BoardGalleryMediaById,
} from './boardLayout';
import { boardPinAppearanceType } from './boardPinAppearance';
import type { BoardEntitySummary } from './boardEntitySummary';
import {
  escapeSvgXml,
  roundSvg,
  svgExportDocument,
  svgExportTitleBlock,
  type SvgExportColors,
} from './svgExport';

export interface BoardSvgOptions {
  title: string;
  subtitle: string;
  colors: SvgExportColors;
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
    (content.overlays ?? []).map(canvasOverlayExportBounds),
  );
  const overlayGroups = renderCanvasOverlaySvg(content.overlays, {
    shift: (x, y) => ({ x: x + offsetX, y: y + offsetY }),
    colors: options.colors,
    stroke: options.colors.text,
  });
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
        `<rect x="${roundSvg(x)}" y="${roundSvg(y)}" width="${roundSvg(labelWidth)}" height="${labelHeight}" rx="4" fill="${options.colors.background}" fill-opacity="0.92" stroke="${options.colors.border}" stroke-width="1"/>`,
        `<text x="${roundSvg(edge.labelX)}" y="${roundSvg(edge.labelY + 4)}" font-size="11" text-anchor="middle" fill="${options.colors.text}">${escapeSvgXml(label)}</text>`,
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
    // The on-screen picture flexes: resizing the pin grows the image while the title block stays
    // a compact footer. Mirror that by anchoring the footer at the bottom with the plain card's
    // row metrics (title +20, type +38, details +56 step 13) and giving the image the rest.
    const footerHeight = 56 + entityLines.length * 13;
    const footerTop = node.y + size.height - 8 - footerHeight;
    const imageHeight = Math.max(0, footerTop - 8 - imageY);
    const clipId = `gallery-clip-${escapeSvgXml(node.id)}`;
    const imageArea = hasGalleryImage
      ? [
          `<defs><clipPath id="${clipId}"><rect x="${roundSvg(imageX)}" y="${roundSvg(imageY)}" width="${roundSvg(imageWidth)}" height="${roundSvg(imageHeight)}" rx="6"/></clipPath></defs>`,
          galleryImage
            ? `<image href="${galleryImage}" x="${roundSvg(imageX)}" y="${roundSvg(imageY)}" width="${roundSvg(imageWidth)}" height="${roundSvg(imageHeight)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`
            : [
                `<rect x="${roundSvg(imageX)}" y="${roundSvg(imageY)}" width="${roundSvg(imageWidth)}" height="${roundSvg(imageHeight)}" rx="6" fill="${options.colors.surface}" stroke="${options.colors.border}"/>`,
                `<g clip-path="url(#${clipId})">`,
                `<circle cx="${roundSvg(imageX + imageWidth / 2 - 20)}" cy="${roundSvg(imageY + imageHeight * 0.36)}" r="9" fill="${options.colors.textSecondary}"/>`,
                `<path d="M ${roundSvg(imageX + imageWidth / 2 + 10)} ${roundSvg(imageY + imageHeight * 0.75)} L ${roundSvg(imageX + imageWidth / 2 + 40)} ${roundSvg(imageY + imageHeight * 0.48)} L ${roundSvg(imageX + imageWidth / 2 + 70)} ${roundSvg(imageY + imageHeight * 0.75)} Z" fill="${options.colors.textSecondary}"/>`,
                '</g>',
              ].join(''),
        ]
      : [];
    const titleY = hasGalleryImage ? footerTop + 20 : node.y + 28;
    const typeY = hasGalleryImage ? footerTop + 38 : node.y + 46;
    const detailBaseY = hasGalleryImage ? footerTop + 56 : node.y + 64;
    return [
      `<rect x="${roundSvg(node.x)}" y="${roundSvg(node.y)}" width="${size.width}" height="${size.height}" rx="10" fill="${fill}"/>`,
      ...imageArea,
      hasGalleryImage
        ? ''
        : `<rect x="${roundSvg(node.x)}" y="${roundSvg(node.y)}" width="5" height="${size.height}" rx="2" fill="${accent}"/>`,
      `<text x="${roundSvg(node.x + 14)}" y="${roundSvg(titleY)}" font-size="12" font-weight="600" fill="${options.colors.text}">${escapeSvgXml(title)}</text>`,
      `<text x="${roundSvg(node.x + 14)}" y="${roundSvg(typeY)}" font-size="10" fill="${options.colors.textSecondary}">${escapeSvgXml(typeLabel)}</text>`,
      ...bodyLines.map(
        (line, index) =>
          `<text x="${roundSvg(node.x + 14)}" y="${roundSvg(node.y + 64 + index * 13)}" font-size="11" fill="${options.colors.text}">${escapeSvgXml(line)}</text>`,
      ),
      ...entityLines.map(
        (line, index) =>
          `<text x="${roundSvg(node.x + 14)}" y="${roundSvg(detailBaseY + index * 13)}" font-size="11" fill="${escapeSvgXml(index === 0 ? options.colors.text : options.colors.textSecondary)}">${escapeSvgXml(line)}</text>`,
      ),
      // Stroke drawn last so the rounded frame stays visible over a full-bleed picture.
      `<rect x="${roundSvg(node.x)}" y="${roundSvg(node.y)}" width="${size.width}" height="${size.height}" rx="10" fill="none" stroke="${options.colors.border}" stroke-width="1"/>`,
    ].join('');
  });

  const body = [
    `<rect x="0" y="0" width="${roundSvg(width)}" height="${roundSvg(totalHeight)}" fill="${options.colors.background}"/>`,
    svgExportTitleBlock(options.title, options.subtitle, options.colors),
    `<g transform="translate(0 ${HEADER})">`,
    ...edgeElements,
    ...overlayGroups.vectors,
    ...nodeElements,
    ...overlayGroups.stamps,
    '</g>',
  ].join('\n');

  return svgExportDocument({ width, height: totalHeight, title: options.title, body });
}

/** Cuts a line of text so it stays inside the card, like the screen's single-line labels. */
function truncate(value: string, maxChars: number): string {
  const normalized = (value ?? '').trim().replace(/\s+/g, ' ');
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars - 1)}…`;
}
