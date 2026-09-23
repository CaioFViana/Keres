import type { SpatialPoint } from '@keres/shared';
import {
  canvasOverlayPolylinePath,
  canvasOverlayRectPath,
} from '@keres/shared/graphs/canvasOverlayGeometry';
import { Circle, DashPathEffect, Path } from '@shopify/react-native-skia';
import React from 'react';

interface OverlayDraftViewProps {
  /** In-progress line/polygon vertices (world); null while a rect tool drags. */
  points: readonly SpatialPoint[] | null;
  /** Live rect drag (world corners); null while tapping vertices. */
  rect: { start: SpatialPoint; end: SpatialPoint } | null;
  color: string;
  scale: number;
}

/**
 * The in-progress drawing inside the surface's Skia overlay: a polyline through the tapped
 * vertices with a dot on each, or a dashed rect while a rect tool drags. Render-only; the
 * draft itself lives in the overlay actions hook (vertices) or the canvas (rect preview).
 */
const OverlayDraftView: React.FC<OverlayDraftViewProps> = ({ points, rect, color, scale }) => {
  const dotRadius = 5 / (scale === 0 ? 1 : scale);
  return (
    <>
      {points && points.length > 0 && (
        <>
          {points.length > 1 && (
            <Path path={canvasOverlayPolylinePath(points)} style="stroke" color={color} strokeWidth={2} />
          )}
          {points.map((point, index) => (
            <Circle key={index} cx={point.x} cy={point.y} r={dotRadius} color={color} />
          ))}
        </>
      )}
      {rect && (
        <Path
          path={canvasOverlayRectPath(
            Math.min(rect.start.x, rect.end.x),
            Math.min(rect.start.y, rect.end.y),
            Math.abs(rect.end.x - rect.start.x),
            Math.abs(rect.end.y - rect.start.y),
          )}
          style="stroke"
          color={color}
          strokeWidth={2}
        >
          <DashPathEffect intervals={[6, 4]} />
        </Path>
      )}
    </>
  );
};

export default OverlayDraftView;
