import {
  canvasOverlayBounds,
  spatialRectIntersects,
  type CanvasOverlayType,
  type SpatialRect,
} from '@keres/shared';
import {
  canvasOverlayArrowhead,
  canvasOverlayEllipsePath,
  canvasOverlayFinalAngle,
  canvasOverlayPolylinePath,
  canvasOverlayRectPath,
} from '@keres/shared/graphs/canvasOverlayGeometry';
import { DashPathEffect, Path, Text as SkiaText } from '@shopify/react-native-skia';
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
}

const LABEL_FONT_SIZE = 11;
const LABEL_HALO_WIDTH = 4;
const DEFAULT_STROKE_WIDTH = 2;
const DEFAULT_POLYGON_FILL_OPACITY = 0.18;
const DEFAULT_SHAPE_FILL_OPACITY = 0.25;
const ARROWHEAD_SIZE = 10;
const DASH_INTERVALS = [6, 4] as const;

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
}) => {
  const visible = useMemo(
    () =>
      (overlays ?? [])
        .filter((overlay) => overlay.kind !== 'stamp')
        .filter((overlay) => spatialRectIntersects(canvasOverlayBounds(overlay), renderWindow))
        .map((overlay, order) => ({ overlay, order }))
        .sort(
          (left, right) =>
            (left.overlay.zIndex ?? 0) - (right.overlay.zIndex ?? 0) || left.order - right.order,
        )
        .map(({ overlay }) => overlay),
    [overlays, renderWindow],
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
        />
      ))}
    </>
  );
};

export default CanvasOverlayLayer;

const OverlayView = React.memo(function OverlayView({
  overlay,
  renderWindow,
  stroke,
  labelBackground,
  font,
}: {
  overlay: CanvasOverlayType;
  renderWindow: SpatialRect;
  stroke: string;
  labelBackground: string;
  font: SkFont | null;
}) {
  const bounds = canvasOverlayBounds(overlay);
  const color = overlay.color ?? stroke;
  const labelX = bounds.x + bounds.width / 2;
  const labelY = bounds.y + bounds.height / 2;
  const labelVisible =
    !!overlay.label &&
    !!font &&
    spatialRectIntersects({ x: labelX, y: labelY, width: 1, height: 1 }, renderWindow);
  const label =
    labelVisible && overlay.label && font ? (
      <OverlayLabel
        x={labelX}
        y={labelY}
        text={overlay.label}
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
          ? canvasOverlayArrowhead(tip, canvasOverlayFinalAngle(overlay.points), ARROWHEAD_SIZE)
          : null;
      return (
        <>
          <Path
            path={path}
            style="stroke"
            color={color}
            strokeWidth={overlay.strokeWidth ?? DEFAULT_STROKE_WIDTH}
          >
            {overlay.dashed ? <DashPathEffect intervals={[...DASH_INTERVALS]} /> : null}
          </Path>
          {arrow && <Path path={polygonPointsToPath(arrow)} color={color} />}
          {label}
        </>
      );
    }
    case 'polygon':
      return (
        <>
          <Path
            path={canvasOverlayPolylinePath(overlay.points, true)}
            color={color}
            opacity={overlay.fillOpacity ?? DEFAULT_POLYGON_FILL_OPACITY}
          />
          <Path
            path={canvasOverlayPolylinePath(overlay.points, true)}
            style="stroke"
            color={color}
            strokeWidth={overlay.strokeWidth ?? DEFAULT_STROKE_WIDTH}
          />
          {label}
        </>
      );
    case 'frame': {
      const path = canvasOverlayRectPath(
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
      );
      return (
        <>
          <Path path={path} style="stroke" color={color} strokeWidth={DEFAULT_STROKE_WIDTH}>
            {overlay.dashed === false ? null : <DashPathEffect intervals={[...DASH_INTERVALS]} />}
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
            <Path path={path} color={color} opacity={DEFAULT_SHAPE_FILL_OPACITY} />
          ) : null}
          <Path
            path={path}
            style="stroke"
            color={color}
            strokeWidth={overlay.strokeWidth ?? DEFAULT_STROKE_WIDTH}
          />
          {label}
        </>
      );
    }
    case 'stamp':
      // Native land (`CanvasStampView`); the vector layer never draws stamps.
      return null;
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
  const labelX = x - measureEdgeLabelWidth(font, text, LABEL_FONT_SIZE) / 2;
  return (
    <>
      <SkiaText
        x={labelX}
        y={y}
        font={font}
        text={text}
        color={halo}
        style="stroke"
        strokeWidth={LABEL_HALO_WIDTH}
      />
      <SkiaText x={labelX} y={y} font={font} text={text} color={color} />
    </>
  );
}
