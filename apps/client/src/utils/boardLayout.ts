import type { BoardContentType, BoardNodeType } from '@keres/shared';

export const BOARD_NODE_WIDTH = 148;
export const BOARD_NODE_HEIGHT = 86;
/** Notes show up to `BOARD_NOTE_BODY_MAX_LINES` lines of body text, so they can grow into a bigger card. */
export const BOARD_NOTE_WIDTH = 220;
export const BOARD_NOTE_HEIGHT = 200;
export const BOARD_NOTE_BODY_MAX_LINES = 10;
/** Gallery pins with a renderable image become a bigger card that includes it. */
export const BOARD_GALLERY_WIDTH = 220;
export const BOARD_GALLERY_HEIGHT = 200;
/** Height of the image area inside a gallery card. */
export const BOARD_GALLERY_IMAGE_HEIGHT = 128;
export const BOARD_CANVAS_PADDING = 240;
export const BOARD_CANVAS_MIN = 720;

/**
 * The part of a gallery pin the board needs to render: an image uses the file itself, a video uses
 * its extracted frame; anything else has no picture and stays an icon card.
 */
export interface BoardGalleryMedia {
  mediaType: string;
  mimeType: string;
  localPath: string | null;
  thumbnailPath: string | null;
}
export type BoardGalleryMediaById = Record<string, BoardGalleryMedia>;

/** Whether a gallery pin has a picture to show (an image file, or a video's extracted frame). */
export function galleryHasImage(media: BoardGalleryMedia | null | undefined): boolean {
  if (!media) return false;
  if (media.mediaType === 'image') return !!media.localPath;
  if (media.mediaType === 'video') return !!media.thumbnailPath;
  return false;
}

/** The entity a pin refers to - `undefined` for notes, which have no entity behind them. */
export function nodeEntityId(node: BoardNodeType): string | undefined {
  return node.kind === 'entity' ? node.entityId : undefined;
}

/** The gallery media behind a node, when it is a Gallery pin. */
export function galleryMediaForNode(
  node: BoardNodeType,
  galleryMediaById?: BoardGalleryMediaById,
): BoardGalleryMedia | null | undefined {
  const entityId = nodeEntityId(node);
  return entityId ? galleryMediaById?.[entityId] : undefined;
}

/** Approximate width of a character at 11px - only to size a note's body line. */
const NOTE_CHAR_WIDTH = 6.2;
/** Horizontal space a note's text can use: 12 left + 8 right padding, minus the 5px accent stripe. */
const NOTE_PADDING_X = 25;
/** Vertical step between body lines (matches the exported SVG's 13px plus a little air). */
const NOTE_LINE_HEIGHT = 14;
/** A note's width in characters at its smallest and largest card. */
const NOTE_MIN_CHARS = Math.floor((BOARD_NODE_WIDTH - NOTE_PADDING_X) / NOTE_CHAR_WIDTH);
const NOTE_MAX_CHARS = Math.floor((BOARD_NOTE_WIDTH - NOTE_PADDING_X) / NOTE_CHAR_WIDTH);

/** How many characters of body text fit on one line of a note of the given width. */
export function noteBodyCharsPerLine(width: number): number {
  return Math.max(NOTE_MIN_CHARS, Math.floor((width - NOTE_PADDING_X) / NOTE_CHAR_WIDTH));
}

/**
 * Breaks a note's body into display lines. The SVG has no text wrapping of its own, and the note's
 * height is derived from the same lines, so the screen and the export agree on how tall the card
 * is. Paragraph breaks (`\n`) are preserved - unlike the shared `wrapLabel`, which collapses them.
 */
export function wrapNoteBody(
  body: string,
  maxLines = BOARD_NOTE_BODY_MAX_LINES,
  maxChars = NOTE_MAX_CHARS,
): string[] {
  const all: string[] = [];
  for (const paragraph of (body ?? '').split('\n')) {
    const words = paragraph.split(' ');
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= maxChars) {
        current = candidate;
        continue;
      }
      if (current) {
        all.push(current);
        current = '';
      }
      // A single word longer than the whole line is cut by force.
      if (word.length > maxChars) {
        all.push(word.slice(0, maxChars));
      } else {
        current = word;
      }
    }
    if (current) all.push(current);
  }
  const truncated = all.length > maxLines;
  const lines = all.slice(0, maxLines);
  if (truncated && lines.length > 0) {
    lines[lines.length - 1] = `${lines[lines.length - 1]}…`;
  }
  return lines;
}

/**
 * Size of a note's card, between the standard pin and the note maximum, following its text: a
 * longer title/body widens the card, and more wrapped body lines grow its height. A note with no
 * body stays at the standard pin size, so a short note does not float in a giant empty card.
 */
export function noteSizeFor(title: string, body: string | null): { width: number; height: number } {
  const normalized = (body ?? '').trim();
  const longestChars = Math.max(
    title.length,
    ...normalized.split('\n').map((paragraph) => paragraph.length),
    0,
  );
  const width = clamp(
    BOARD_NODE_WIDTH + (longestChars - NOTE_MIN_CHARS) * NOTE_CHAR_WIDTH,
    BOARD_NODE_WIDTH,
    BOARD_NOTE_WIDTH,
  );
  const lines = wrapNoteBody(normalized, BOARD_NOTE_BODY_MAX_LINES, noteBodyCharsPerLine(width));
  const height = clamp(
    BOARD_NODE_HEIGHT + lines.length * NOTE_LINE_HEIGHT,
    BOARD_NODE_HEIGHT,
    BOARD_NOTE_HEIGHT,
  );
  return { width, height };
}

/** Size of a node's card: notes grow with their text, gallery pins with a picture grow to include it. */
export function boardNodeSize(
  node: BoardNodeType,
  galleryMedia?: BoardGalleryMedia | null,
): { width: number; height: number } {
  if (node.kind === 'note') {
    return noteSizeFor(node.title, node.body);
  }
  if (node.kind === 'entity' && node.entityType === 'Gallery' && galleryHasImage(galleryMedia)) {
    return { width: BOARD_GALLERY_WIDTH, height: BOARD_GALLERY_HEIGHT };
  }
  return { width: BOARD_NODE_WIDTH, height: BOARD_NODE_HEIGHT };
}

export function boardCanvasSize(
  nodes: BoardNodeType[],
  minWidth = BOARD_CANVAS_MIN,
  minHeight = BOARD_CANVAS_MIN,
  galleryMediaById?: BoardGalleryMediaById,
): { width: number; height: number } {
  const { width, height } = boardCanvasBounds(nodes, minWidth, minHeight, galleryMediaById);
  return { width, height };
}

/**
 * The screen's drawable world bounds. `originX`/`originY` map raw, persisted board coordinates
 * onto the surface; they let the canvas grow above and to the left without rewriting any node.
 */
export function boardCanvasBounds(
  nodes: BoardNodeType[],
  minWidth = BOARD_CANVAS_MIN,
  minHeight = BOARD_CANVAS_MIN,
  galleryMediaById?: BoardGalleryMediaById,
): { width: number; height: number; originX: number; originY: number } {
  if (nodes.length === 0) {
    return { width: minWidth, height: minHeight, originX: 0, originY: 0 };
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = 0;
  let maxY = 0;
  for (const node of nodes) {
    const size = boardNodeSize(node, galleryMediaForNode(node, galleryMediaById));
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + size.width);
    maxY = Math.max(maxY, node.y + size.height);
  }
  // Keep the existing zero-based plane until a pin actually crosses its top/left edge. At that
  // point reserve a full margin on the newly exposed side, so it remains usable after the drag.
  const originX = minX < 0 ? minX - BOARD_CANVAS_PADDING : 0;
  const originY = minY < 0 ? minY - BOARD_CANVAS_PADDING : 0;
  return {
    width: Math.max(minWidth, maxX - originX + BOARD_CANVAS_PADDING),
    height: Math.max(minHeight, maxY - originY + BOARD_CANVAS_PADDING),
    originX,
    originY,
  };
}

/**
 * Bounds of the board plus the offset that puts every node inside the drawing.
 *
 * Nodes are free to be dragged anywhere, including outside the area the screen renders, and the
 * export must never cut one: this shifts every node so the top-left corner of the bounding box
 * lands on `BOARD_CANVAS_PADDING`, and sizes the canvas to the box plus that padding on all sides.
 * The editor similarly uses a translated world plane; only the exported file is normalised, so
 * the saved content is never rewritten.
 */
export function normalizeBoardCanvas(
  nodes: BoardNodeType[],
  minWidth = BOARD_CANVAS_MIN,
  minHeight = BOARD_CANVAS_MIN,
  galleryMediaById?: BoardGalleryMediaById,
): { offsetX: number; offsetY: number; width: number; height: number } {
  if (nodes.length === 0) {
    return { offsetX: 0, offsetY: 0, width: minWidth, height: minHeight };
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const node of nodes) {
    const size = boardNodeSize(node, galleryMediaForNode(node, galleryMediaById));
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + size.width);
    maxY = Math.max(maxY, node.y + size.height);
  }
  return {
    offsetX: BOARD_CANVAS_PADDING - minX,
    offsetY: BOARD_CANVAS_PADDING - minY,
    width: Math.max(minWidth, maxX - minX + BOARD_CANVAS_PADDING * 2),
    height: Math.max(minHeight, maxY - minY + BOARD_CANVAS_PADDING * 2),
  };
}

export function nextStaggeredPosition(
  content: BoardContentType,
  origin: { x: number; y: number },
): { x: number; y: number } {
  const index = content.nodes.length;
  return { x: origin.x + (index % 4) * 24, y: origin.y + (index % 4) * 24 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
