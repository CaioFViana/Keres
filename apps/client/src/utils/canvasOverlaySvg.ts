import {
  CANVAS_OVERLAY_STAMP_DEFAULT_SIZE,
  canvasOverlayBounds,
  type CanvasOverlayType,
  type SpatialPoint,
  type SpatialRect,
} from '@keres/shared';
import {
  CANVAS_OVERLAY_ARROWHEAD_SIZE,
  CANVAS_OVERLAY_DASH_INTERVALS,
  CANVAS_OVERLAY_DEFAULT_STROKE_WIDTH,
  CANVAS_OVERLAY_LABEL_FONT_SIZE,
  CANVAS_OVERLAY_LABEL_HALO_WIDTH,
  CANVAS_OVERLAY_POLYGON_FILL_OPACITY,
  CANVAS_OVERLAY_SHAPE_FILL_OPACITY,
  canvasOverlayArrowhead,
  canvasOverlayEllipsePath,
  canvasOverlayFinalAngle,
  canvasOverlayPolylinePath,
  canvasOverlayRectPath,
} from '@keres/shared/graphs/canvasOverlayGeometry';
import { renderMapIconSvg } from './mapIconSvg';
import { escapeSvgXml, roundSvg, type SvgExportColors } from './svgExport';

export interface CanvasOverlaySvgContext {
  /** World-to-export translation each surface supplies from its own normalization. */
  shift: (x: number, y: number) => { x: number; y: number };
  colors: SvgExportColors;
}

export interface CanvasOverlaySvgGroups {
  /** Lines, polygons, frames and shapes: painted above edges, below nodes. */
  vectors: string[];
  /** Stamps ride the node plane on screen: painted above nodes. */
  stamps: string[];
}

/** Vertical room a stamp's label needs below its circle, like map node names. */
const STAMP_LABEL_EXTENT = 18;
/** Stamp glyph size relative to the circle, mirroring `CanvasStampView`. */
const STAMP_ICON_RATIO = 0.55;
/** Stamps read as map points, so they share the node label size. */
const STAMP_LABEL_FONT_SIZE = 10;
/** Stamp circle border, mirroring `CanvasStampView`. */
const STAMP_BORDER_WIDTH = 1.5;

/**
 * Bounds an overlay reserves on the exported canvas: the shared tight bounds, extended
 * below a labelled stamp's circle for its name like map node names are.
 */
export function canvasOverlayExportBounds(overlay: CanvasOverlayType): SpatialRect {
  const bounds = canvasOverlayBounds(overlay);
  if (overlay.kind !== 'stamp' || !overlay.label) return bounds;
  return { ...bounds, height: bounds.height + STAMP_LABEL_EXTENT };
}

/**
 * The overlays as SVG elements, mirroring `CanvasOverlayLayer` + `CanvasStampView` through
 * the shared path math: same strokes, dashes, fills, arrowheads and label placement.
 * Split in two paint groups so each exporter keeps the screen's order (vectors below
 * the nodes, stamps above them). Both surfaces share this - the export cannot drift.
 */
export function renderCanvasOverlaySvg(
  overlays: readonly CanvasOverlayType[] | undefined,
  context: CanvasOverlaySvgContext,
): CanvasOverlaySvgGroups {
  const groups: CanvasOverlaySvgGroups = { vectors: [], stamps: [] };
  const ordered = (overlays ?? [])
    .map((overlay, order) => ({ overlay, order }))
    .sort(
      (left, right) =>
        (left.overlay.zIndex ?? 0) - (right.overlay.zIndex ?? 0) || left.order - right.order,
    )
    .map(({ overlay }) => overlay);
  for (const overlay of ordered) {
    if (overlay.kind === 'stamp') {
      groups.stamps.push(renderStamp(overlay, context));
    } else {
      groups.vectors.push(renderVector(overlay, context));
    }
  }
  return groups;
}

type VectorOverlay = Exclude<CanvasOverlayType, { kind: 'stamp' }>;
type StampOverlay = Extract<CanvasOverlayType, { kind: 'stamp' }>;

function shiftedPoint(
  context: CanvasOverlaySvgContext,
  point: SpatialPoint,
): { x: number; y: number } {
  const shifted = context.shift(point.x, point.y);
  return { x: roundSvg(shifted.x), y: roundSvg(shifted.y) };
}

/** Rounds the shared arrowhead's `x,y` pairs so the file stays tidy. */
function roundPoints(points: string): string {
  return points
    .split(' ')
    .map((pair) => pair.split(',').map(Number).map(roundSvg).join(','))
    .join(' ');
}

function renderLabel(
  x: number,
  y: number,
  text: string,
  color: string,
  halo: string,
  fontSize: number,
): string {
  const safe = escapeSvgXml(text);
  const cx = roundSvg(x);
  const cy = roundSvg(y);
  // Halo first, then the text: the same double-draw the map exporter gives node names.
  return (
    `<text x="${cx}" y="${cy}" font-size="${fontSize}" text-anchor="middle" fill="${halo}" stroke="${halo}" stroke-width="${CANVAS_OVERLAY_LABEL_HALO_WIDTH}" stroke-linejoin="round">${safe}</text>` +
    `<text x="${cx}" y="${cy}" font-size="${fontSize}" text-anchor="middle" fill="${color}">${safe}</text>`
  );
}

function renderVector(overlay: VectorOverlay, context: CanvasOverlaySvgContext): string {
  const color = escapeSvgXml(overlay.color ?? context.colors.text);
  const bounds = canvasOverlayBounds(overlay);
  const center = context.shift(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  const label = overlay.label
    ? renderLabel(
        center.x,
        center.y,
        overlay.label,
        color,
        context.colors.background,
        CANVAS_OVERLAY_LABEL_FONT_SIZE,
      )
    : '';
  switch (overlay.kind) {
    case 'line': {
      const shifted = overlay.points.map((point) => shiftedPoint(context, point));
      const d = canvasOverlayPolylinePath(shifted);
      const parts = [
        `<path d="${d}" fill="none" stroke="${color}" stroke-width="${overlay.strokeWidth ?? CANVAS_OVERLAY_DEFAULT_STROKE_WIDTH}"${overlay.dashed ? ` stroke-dasharray="${CANVAS_OVERLAY_DASH_INTERVALS.join(' ')}"` : ''}/>`,
      ];
      if (overlay.directed && shifted.length >= 2) {
        const tip = shifted[shifted.length - 1];
        const points = roundPoints(
          canvasOverlayArrowhead(tip, canvasOverlayFinalAngle(shifted), CANVAS_OVERLAY_ARROWHEAD_SIZE),
        );
        parts.push(`<polygon points="${points}" fill="${color}"/>`);
      }
      parts.push(label);
      return parts.join('');
    }
    case 'polygon': {
      const shifted = overlay.points.map((point) => shiftedPoint(context, point));
      const d = canvasOverlayPolylinePath(shifted, true);
      return (
        `<path d="${d}" fill="${color}" fill-opacity="${overlay.fillOpacity ?? CANVAS_OVERLAY_POLYGON_FILL_OPACITY}"/>` +
        `<path d="${d}" fill="none" stroke="${color}" stroke-width="${overlay.strokeWidth ?? CANVAS_OVERLAY_DEFAULT_STROKE_WIDTH}"/>` +
        label
      );
    }
    case 'frame':
    case 'shape': {
      const top = shiftedPoint(context, { x: bounds.x, y: bounds.y });
      const width = roundSvg(bounds.width);
      const height = roundSvg(bounds.height);
      const d =
        overlay.kind === 'shape' && overlay.shapeType === 'ellipse'
          ? canvasOverlayEllipsePath(top.x, top.y, width, height)
          : canvasOverlayRectPath(top.x, top.y, width, height);
      const filled =
        overlay.kind === 'shape' && overlay.filled
          ? `<path d="${d}" fill="${color}" fill-opacity="${CANVAS_OVERLAY_SHAPE_FILL_OPACITY}"/>`
          : '';
      // Frames dash unless opted out; shapes never dash on screen either.
      const dashed = overlay.kind === 'frame' && overlay.dashed !== false;
      // Frames ignore `strokeWidth` on screen too - always the default width.
      const strokeWidth =
        overlay.kind === 'frame'
          ? CANVAS_OVERLAY_DEFAULT_STROKE_WIDTH
          : (overlay.strokeWidth ?? CANVAS_OVERLAY_DEFAULT_STROKE_WIDTH);
      return (
        filled +
        `<path d="${d}" fill="none" stroke="${color}" stroke-width="${strokeWidth}"${dashed ? ` stroke-dasharray="${CANVAS_OVERLAY_DASH_INTERVALS.join(' ')}"` : ''}/>` +
        label
      );
    }
  }
}

function renderStamp(overlay: StampOverlay, context: CanvasOverlaySvgContext): string {
  const size = overlay.size ?? CANVAS_OVERLAY_STAMP_DEFAULT_SIZE;
  const center = shiftedPoint(context, { x: overlay.x, y: overlay.y });
  const color = escapeSvgXml(overlay.color ?? context.colors.primary);
  const parts = [
    `<circle cx="${center.x}" cy="${center.y}" r="${roundSvg(size / 2)}" fill="${context.colors.surface}" stroke="${color}" stroke-width="${STAMP_BORDER_WIDTH}"/>`,
    renderMapIconSvg(overlay.icon, center.x, center.y, color, size * STAMP_ICON_RATIO),
  ];
  if (overlay.label) {
    parts.push(
      renderLabel(
        center.x,
        center.y + size / 2 + 14,
        overlay.label,
        context.colors.text,
        context.colors.background,
        STAMP_LABEL_FONT_SIZE,
      ),
    );
  }
  return parts.join('');
}
