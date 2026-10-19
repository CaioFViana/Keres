import {
  sketchStrokeLineCap,
  sketchStrokePathData,
  transformedBoundsCorners,
  type SketchMatrix,
  type SketchStroke,
  type SpatialRect,
} from '@keres/shared';
import { Circle, DashPathEffect, Group, Path, Rect } from '@shopify/react-native-skia';
import React from 'react';

/** Transient feedback for the gesture in progress; none of it is part of the document. */
export type SketchPreview =
  | { kind: 'stroke'; stroke: SketchStroke }
  | { kind: 'eraser'; x: number; y: number; radius: number }
  | { kind: 'lasso'; points: number[] };

export interface SketchSelectionChrome {
  bounds: SpatialRect;
  /** The live drag transform; identity while at rest. */
  matrix: SketchMatrix;
}

interface SketchPreviewViewProps {
  preview: SketchPreview | null;
  selection: SketchSelectionChrome | null;
  scale: number;
  color: string;
  /** Knob/handle sizes in screen pixels, divided by the zoom here. */
  handleSize: number;
  knobDistance: number;
}

function polygonPath(points: readonly number[], closed: boolean): string {
  if (points.length < 4) return '';
  let d = `M${points[0]} ${points[1]}`;
  for (let index = 2; index + 1 < points.length; index += 2)
    d += `L${points[index]} ${points[index + 1]}`;
  return closed ? `${d}Z` : d;
}

const SketchPreviewView: React.FC<SketchPreviewViewProps> = ({
  preview,
  selection,
  scale,
  color,
  handleSize,
  knobDistance,
}) => {
  const safeScale = scale === 0 ? 1 : scale;
  const unit = 1 / safeScale;
  return (
    <>
      {preview?.kind === 'stroke' && (
        <Path
          path={sketchStrokePathData(preview.stroke.points)}
          style="stroke"
          color={preview.stroke.color}
          opacity={preview.stroke.alpha}
          strokeWidth={preview.stroke.size}
          strokeCap={sketchStrokeLineCap(preview.stroke)}
          strokeJoin="round"
        />
      )}
      {preview?.kind === 'eraser' && (
        <>
          <Circle cx={preview.x} cy={preview.y} r={preview.radius} color="rgba(255,255,255,0.35)" />
          <Circle
            cx={preview.x}
            cy={preview.y}
            r={preview.radius}
            style="stroke"
            strokeWidth={1.5 * unit}
            color={color}
          />
        </>
      )}
      {preview?.kind === 'lasso' && preview.points.length >= 4 && (
        <Path
          path={polygonPath(preview.points, true)}
          style="stroke"
          strokeWidth={1.5 * unit}
          color={color}
        >
          <DashPathEffect intervals={[6 * unit, 4 * unit]} />
        </Path>
      )}
      {selection && (
        <Group>
          <Path
            path={polygonPath(transformedBoundsCorners(selection.bounds, selection.matrix), true)}
            style="stroke"
            strokeWidth={1.5 * unit}
            color={color}
          >
            <DashPathEffect intervals={[6 * unit, 4 * unit]} />
          </Path>
          <SelectionHandles
            bounds={selection.bounds}
            matrix={selection.matrix}
            size={handleSize * unit}
            knobDistance={knobDistance * unit}
            color={color}
            unit={unit}
          />
        </Group>
      )}
    </>
  );
};

/** Handles ride the transformed corners so they follow the drag; the knob keeps its screen offset. */
const SelectionHandles: React.FC<{
  bounds: SpatialRect;
  matrix: SketchMatrix;
  size: number;
  knobDistance: number;
  color: string;
  unit: number;
}> = ({ bounds, matrix, size, knobDistance, color, unit }) => {
  const corners = transformedBoundsCorners(bounds, matrix);
  const top = { x: (corners[0] + corners[2]) / 2, y: (corners[1] + corners[3]) / 2 };
  const edgeX = corners[2] - corners[0];
  const edgeY = corners[3] - corners[1];
  const length = Math.hypot(edgeX, edgeY) || 1;
  // Outward normal of the top edge (clockwise corners), so the knob floats away from the box.
  const knob = {
    x: top.x + (edgeY / length) * knobDistance,
    y: top.y - (edgeX / length) * knobDistance,
  };
  return (
    <>
      <Path
        path={`M${top.x} ${top.y}L${knob.x} ${knob.y}`}
        style="stroke"
        strokeWidth={unit}
        color={color}
      />
      <Circle cx={knob.x} cy={knob.y} r={size * 0.6} color={color} />
      {[0, 1, 2, 3].map((index) => (
        <Rect
          key={index}
          x={corners[index * 2] - size / 2}
          y={corners[index * 2 + 1] - size / 2}
          width={size}
          height={size}
          color={color}
        />
      ))}
    </>
  );
};

export default React.memo(SketchPreviewView);
