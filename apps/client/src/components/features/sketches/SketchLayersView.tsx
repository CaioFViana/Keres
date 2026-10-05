import {
  sketchStrokePathData,
  type SketchItem,
  type SketchLayerDoc,
  type SketchMatrix,
} from '@keres/shared';
import { Group, Path, Picture, Skia } from '@shopify/react-native-skia';
import React, { memo, useMemo } from 'react';
import type { ErasePreview } from '../../../hooks/useSketchDrawing';
import { SketchLayerPictures } from './sketchPictures';

/** The selection being dragged: its items render through `matrix` instead of with the layer. */
export interface SketchLiveTransform {
  layerId: string;
  items: ReadonlySet<SketchItem>;
  matrix: SketchMatrix;
}

interface SketchLayersViewProps {
  layers: readonly SketchLayerDoc[];
  transform: SketchLiveTransform | null;
  /** The eraser's gesture in progress; it clears a path through the layer it works on. */
  erase?: ErasePreview | null;
}

function skiaMatrix(matrix: SketchMatrix) {
  return Skia.Matrix([matrix.a, matrix.c, matrix.e, matrix.b, matrix.d, matrix.f, 0, 0, 1]);
}

const LayerNode = memo(function LayerNode({
  layer,
  transform,
  erase,
}: {
  layer: SketchLayerDoc;
  transform: SketchLiveTransform | null;
  erase: ErasePreview | null;
}) {
  const plain = useMemo(() => new SketchLayerPictures(), []);
  const moving = useMemo(() => new SketchLayerPictures(), []);
  const dragging = transform !== null;
  const pictures = useMemo(() => {
    const items =
      dragging && transform
        ? layer.items.filter((item) => !transform.items.has(item))
        : layer.items;
    return plain.update(items);
    // `transform.items` is stable for the whole drag; its identity is the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer.items, dragging, plain, transform?.items]);
  const movingPictures = useMemo(
    () =>
      dragging && transform
        ? moving.update(layer.items.filter((item) => transform.items.has(item)))
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layer.items, dragging, moving, transform?.items],
  );
  const movingMatrix = useMemo(
    () => (transform ? skiaMatrix(transform.matrix) : null),
    [transform],
  );
  // Layer opacity is a real layer: the strokes composite together first, then fade as one. Group's
  // own `opacity` prop only scales the paint of draw commands, and a recorded Picture ignores it.
  const layerPaint = useMemo(() => {
    if (layer.opacity >= 1) return undefined;
    const paint = Skia.Paint();
    paint.setAlphaf(Math.max(0, layer.opacity));
    return paint;
  }, [layer.opacity]);
  // While the eraser is down, strokes are already cut but fills are only cut when it lifts. Drawing
  // the eraser's own path as a Clear stroke inside the layer shows the fills going away live, and
  // matches what the gesture will leave behind.
  const clearPath = useMemo(
    () => (erase ? sketchStrokePathData(erase.path) : null),
    // `version` changes while the same path array grows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [erase, erase?.version],
  );
  return (
    <Group layer={erase ? (layerPaint ?? true) : layerPaint}>
      {pictures.map((picture, index) => (
        <Picture key={index} picture={picture} />
      ))}
      {erase && clearPath && (
        <Path
          path={clearPath}
          style="stroke"
          color="black"
          blendMode="clear"
          strokeWidth={erase.radius * 2}
          strokeCap="round"
          strokeJoin="round"
        />
      )}
      {movingMatrix && movingPictures.length > 0 && (
        <Group matrix={movingMatrix}>
          {movingPictures.map((picture, index) => (
            <Picture key={index} picture={picture} />
          ))}
        </Group>
      )}
    </Group>
  );
});

/**
 * The drawing: one Skia group per visible layer, bottom to top, each a few recorded pictures
 * that only re-record when their own items change. While a selection is dragged, its items
 * leave their layer's pictures and ride a transformed group, so nothing is recomputed per frame.
 */
const SketchLayersView: React.FC<SketchLayersViewProps> = ({ layers, transform, erase = null }) => (
  <>
    {layers
      .filter((layer) => layer.visible)
      .map((layer) => (
        <LayerNode
          key={layer.id}
          layer={layer}
          transform={transform && transform.layerId === layer.id ? transform : null}
          erase={erase && erase.layerId === layer.id ? erase : null}
        />
      ))}
  </>
);

export default memo(SketchLayersView);
