import {
  sketchFillPathData,
  sketchStrokeLineCap,
  sketchStrokePathData,
  type SketchItem,
} from '@keres/shared';
import {
  createPicture,
  FillType,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
  type SkPath,
  type SkPicture,
} from '@shopify/react-native-skia';

/** Items per recorded picture: small enough that an edit re-records little. */
export const SKETCH_PICTURE_CHUNK = 96;

const pathCache = new WeakMap<SketchItem, SkPath | null>();

/** The item's Skia path, parsed once per item object (items are immutable). */
export function sketchItemPath(item: SketchItem): SkPath | null {
  const cached = pathCache.get(item);
  if (cached !== undefined) return cached;
  const data =
    item.kind === 'stroke' ? sketchStrokePathData(item.points) : sketchFillPathData(item.rings);
  let path: SkPath | null = null;
  try {
    path = data ? Skia.Path.MakeFromSVGString(data) : null;
    if (path && item.kind === 'fill') path.setFillType(FillType.EvenOdd);
  } catch {
    path = null;
  }
  pathCache.set(item, path);
  return path;
}

function makePaint(item: SketchItem) {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color(item.color));
  paint.setAlphaf(item.alpha);
  if (item.kind === 'stroke') {
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeWidth(item.size);
    paint.setStrokeCap(sketchStrokeLineCap(item) === 'round' ? StrokeCap.Round : StrokeCap.Butt);
    paint.setStrokeJoin(StrokeJoin.Round);
  } else {
    paint.setStyle(PaintStyle.Fill);
  }
  return paint;
}

/** Records items into one picture; unparseable items are skipped, never fatal. */
export function recordSketchPicture(items: readonly SketchItem[]): SkPicture {
  return createPicture((canvas) => {
    for (const item of items) {
      const path = sketchItemPath(item);
      if (!path) continue;
      canvas.drawPath(path, makePaint(item));
    }
  });
}

interface ChunkEntry {
  items: SketchItem[];
  picture: SkPicture;
}

/**
 * Pictures of one layer, chunked. A new stroke only re-records the tail chunk and an unchanged
 * layer returns the very same pictures, so React skips the Skia nodes entirely. An erase that
 * shifts the item list re-records from the cut on; chunks before it are reused by reference.
 */
export class SketchLayerPictures {
  private chunks: ChunkEntry[] = [];

  update(items: readonly SketchItem[]): SkPicture[] {
    const next: ChunkEntry[] = [];
    for (let start = 0; start < items.length; start += SKETCH_PICTURE_CHUNK) {
      const slice = items.slice(start, start + SKETCH_PICTURE_CHUNK);
      const previous = this.chunks[next.length];
      if (
        previous &&
        previous.items.length === slice.length &&
        previous.items.every((item, index) => item === slice[index])
      ) {
        next.push(previous);
      } else {
        next.push({ items: slice, picture: recordSketchPicture(slice) });
      }
    }
    this.chunks = next;
    return next.map((entry) => entry.picture);
  }
}
