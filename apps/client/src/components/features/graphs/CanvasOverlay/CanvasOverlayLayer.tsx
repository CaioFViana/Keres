import {
  canvasOverlayBounds,
  canvasOverlayTextFontSize,
  spatialRectIntersects,
  wrapCanvasOverlayText,
  type CanvasOverlayType,
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
import { DashPathEffect, Path, Skia, Text as SkiaText } from '@shopify/react-native-skia';
import type { SkFont } from '@shopify/react-native-skia';
import React, { useMemo } from 'react';
import { measureEdgeLabelWidth } from '../SkiaEdgeCanvas/measureEdgeLabelWidth';
import { polygonPointsToPath } from '../SkiaEdgeCanvas/polygonPointsToPath';

interface CanvasOverlayLayerProps {
  overlays: readonly CanvasOverlayType[] | undefined;
  renderWindow: SpatialRect;
  /** Stroke color when the overlay sets none. */
  stroke: string;
  /** Label halo color (usually the canvas background). */
  labelBackground: string;
  /** Null-safe: without a font the vectors draw and only labels are skipped. */
  font: SkFont | null;
  /**
   * Sketch layers: hidden layers skip their overlays, layers below 1 paint them
   * translucent. Boards and maps pass nothing and keep today's rendering.
   */
  isOverlayHidden?: (overlay: CanvasOverlayType) => boolean;
  overlayOpacity?: (overlay: CanvasOverlayType) => number;
}

/**
 * The vector overlays of a Board or Location Map, drawn as children of the surface's own
 * `SkiaEdgeCanvas` (one canvas element per surface - this layer never mounts its own).
 * Whole-overlay culling by shared bounds: unlike node edges, overlay paths are drawn
 * unclipped and Skia clips them to the viewport.
 *
 * Stamps are native views, not vectors (`CanvasStampView`): Skia cannot render Ionicons
 * glyphs, so this layer skips them and each surface's node plane draws them instead.
 */
const CanvasOverlayLayer: React.FC<CanvasOverlayLayerProps> = ({
  overlays,
  renderWindow,
  stroke,
  labelBackground,
  font,
  isOverlayHidden,
  overlayOpacity,
}) => {
  const visible = useMemo(
    () =>
      (overlays ?? [])
        .filter((overlay) => overlay.kind !== 'stamp')
        .filter((overlay) => !(isOverlayHidden?.(overlay) ?? false))
        .filter((overlay) => spatialRectIntersects(canvasOverlayBounds(overlay), renderWindow))
        .map((overlay, order) => ({ overlay, order }))
        .sort(
          (left, right) =>
            (left.overlay.zIndex ?? 0) - (right.overlay.zIndex ?? 0) || left.order - right.order,
        )
        .map(({ overlay }) => overlay),
    [overlays, renderWindow, isOverlayHidden],
  );
  return (
    <>
      {visible.map((overlay) => (
        <OverlayView
          key={overlay.id}
          overlay={overlay}
          renderWindow={renderWindow}
          stroke={stroke}
          labelBackground={labelBackground}
          font={font}
          opacity={overlayOpacity?.(overlay) ?? 1}
        />
      ))}
    </>
  );
};

export default CanvasOverlayLayer;

/**
 * A font at the overlay's own size, derived from the shared base font's typeface. The
 * canvases load one base font (edge labels), while text overlays carry their own size -
 * rendering with the base font would draw every size identically and only move the layout
 * box. Anything that cannot derive (no font, no typeface, mocked Skia) falls back to the
 * base font or null, never throws during render.
 */
export function sizedOverlayFont(base: SkFont | null, fontSize: number): SkFont | null {
  if (!base) return null;
  try {
    const face = base.getTypeface?.();
    if (!face) return base;
    return Skia.Font(face, fontSize);
  } catch {
    return base;
  }
}

const OverlayView = React.memo(function OverlayView({
  overlay,
  renderWindow,
  stroke,
  labelBackground,
  font,
  opacity,
}: {
  overlay: CanvasOverlayType;
  renderWindow: SpatialRect;
  stroke: string;
  labelBackground: string;
  font: SkFont | null;
  opacity: number;
}) {
  const bounds = canvasOverlayBounds(overlay);
  const color = overlay.color ?? stroke;
  const textSize = overlay.kind === 'text' ? canvasOverlayTextFontSize(overlay) : 0;
  const textFont = useMemo(
    () => (overlay.kind === 'text' ? sizedOverlayFont(font, textSize) : null),
    [font, overlay, textSize],
  );
  const labelX = bounds.x + bounds.width / 2;
  const labelY = bounds.y + bounds.height / 2;
  const labelled = overlay.kind !== 'text' ? overlay.label : undefined;
  const labelVisible =
    !!labelled &&
    !!font &&
    spatialRectIntersects({ x: labelX, y: labelY, width: 1, height: 1 }, renderWindow);
  const label =
    labelVisible && labelled && font ? (
      <OverlayLabel
        x={labelX}
        y={labelY}
        text={labelled}
        color={color}
        halo={labelBackground}
        font={font}
      />
    ) : null;

  switch (overlay.kind) {
    case 'line': {
      const path = canvasOverlayPolylinePath(overlay.points);
      const tip = overlay.points[overlay.points.length - 1];
      const arrow =
        overlay.directed && overlay.points.length >= 2
          ? canvasOverlayArrowhead(
              tip,
              canvasOverlayFinalAngle(overlay.points),
              CANVAS_OVERLAY_ARROWHEAD_SIZE,
            )
          : null;
      return (
        <>
          <Path
            path={path}
            style="stroke"
            color={color}
            strokeWidth={overlay.strokeWidth ?? CANVAS_OVERLAY_DEFAULT_STROKE_WIDTH}
          >
            {overlay.dashed ? (
              <DashPathEffect intervals={[...CANVAS_OVERLAY_DASH_INTERVALS]} />
            ) : null}
          </Path>
          {arrow && <Path path={polygonPointsToPath(arrow)} color={color} />}
          {label}
        </>
      );
    }
    case 'polygon':
      return (
        <>
          {overlay.filled ? (
            <Path
              path={canvasOverlayPolylinePath(overlay.points, true)}
              color={color}
              opacity={overlay.fillOpacity ?? CANVAS_OVERLAY_POLYGON_FILL_OPACITY}
            />
          ) : null}
          <Path
            path={canvasOverlayPolylinePath(overlay.points, true)}
            style="stroke"
            color={color}
            strokeWidth={overlay.strokeWidth ?? CANVAS_OVERLAY_DEFAULT_STROKE_WIDTH}
          >
            {overlay.dashed ? (
              <DashPathEffect intervals={[...CANVAS_OVERLAY_DASH_INTERVALS]} />
            ) : null}
          </Path>
          {label}
        </>
      );
    case 'frame': {
      const path = canvasOverlayRectPath(bounds.x, bounds.y, bounds.width, bounds.height);
      return (
        <>
          {overlay.filled ? (
            <Path path={path} color={color} opacity={CANVAS_OVERLAY_SHAPE_FILL_OPACITY} />
          ) : null}
          <Path
            path={path}
            style="stroke"
            color={color}
            strokeWidth={CANVAS_OVERLAY_DEFAULT_STROKE_WIDTH}
          >
            {overlay.dashed === false ? null : (
              <DashPathEffect intervals={[...CANVAS_OVERLAY_DASH_INTERVALS]} />
            )}
          </Path>
          {label}
        </>
      );
    }
    case 'shape': {
      const path =
        overlay.shapeType === 'ellipse'
          ? canvasOverlayEllipsePath(bounds.x, bounds.y, bounds.width, bounds.height)
          : canvasOverlayRectPath(bounds.x, bounds.y, bounds.width, bounds.height);
      return (
        <>
          {overlay.filled ? (
            <Path path={path} color={color} opacity={CANVAS_OVERLAY_SHAPE_FILL_OPACITY} />
          ) : null}
          <Path
            path={path}
            style="stroke"
            color={color}
            strokeWidth={overlay.strokeWidth ?? CANVAS_OVERLAY_DEFAULT_STROKE_WIDTH}
          >
            {overlay.dashed ? (
              <DashPathEffect intervals={[...CANVAS_OVERLAY_DASH_INTERVALS]} />
            ) : null}
          </Path>
          {label}
        </>
      );
    }
    case 'stamp':
      // Native land (`CanvasStampView`); the vector layer never draws stamps.
      return null;
    case 'text': {
      // No font, no text: same null-safe rule as labels. Lines wrap through the shared
      // estimator, so the screen breaks exactly where the SVG exporter does. The font is
      // the overlay's own size, so growing the size grows the glyphs, not just the box.
      if (!textFont) return null;
      const fontSize = canvasOverlayTextFontSize(overlay);
      const lines = wrapCanvasOverlayText(overlay.content, overlay.width, fontSize);
      const lineHeight = fontSize * 1.35;
      const centered = (overlay.align ?? 'left') === 'center';
      return (
        <>
          {lines.map((line, index) => {
            const width = measureEdgeLabelWidth(textFont, line || ' ', fontSize);
            const x = centered ? bounds.x + (bounds.width - width) / 2 : bounds.x;
            return (
              <SkiaText
                key={index}
                x={x}
                y={bounds.y + fontSize + index * lineHeight}
                font={textFont}
                text={line || ' '}
                color={color}
                opacity={opacity}
              />
            );
          })}
        </>
      );
    }
  }
});

function OverlayLabel({
  x,
  y,
  text,
  color,
  halo,
  font,
}: {
  x: number;
  y: number;
  text: string;
  color: string;
  halo: string;
  font: SkFont;
}) {
  // Skia has no `textAnchor`: center by measured width instead. Both place the baseline at
  // the same y.
  const labelX = x - measureEdgeLabelWidth(font, text, CANVAS_OVERLAY_LABEL_FONT_SIZE) / 2;
  return (
    <>
      <SkiaText
        x={labelX}
        y={y}
        font={font}
        text={text}
        color={halo}
        style="stroke"
        strokeWidth={CANVAS_OVERLAY_LABEL_HALO_WIDTH}
      />
      <SkiaText x={labelX} y={y} font={font} text={text} color={color} />
    </>
  );
}
