import { simplifyFlatPoints } from './sketchGeometry';
import { MAX_SKETCH_RINGS_PER_FILL } from './sketchTypes';

/**
 * Bucket fill, in two pure steps. The client rasterizes what the user sees into an RGBA buffer
 * and calls `floodFillMask` from the tapped pixel; `maskToFillRings` then turns the region into
 * closed rings in world units. The stored fill is those rings, never the pixels: the result is
 * identical on every platform and weighs a few hundred bytes.
 */

export interface RgbaBuffer {
  data: ArrayLike<number>;
  width: number;
  height: number;
}

export interface FillMask {
  mask: Uint8Array;
  width: number;
  height: number;
  /** Pixels in the region. */
  count: number;
  /** The region reaches the bitmap's border: on a drawn page that usually means the outline leaks. */
  touchesEdge: boolean;
}

function channelDistance(data: ArrayLike<number>, a: number, b: number): number {
  return Math.max(
    Math.abs(data[a] - data[b]),
    Math.abs(data[a + 1] - data[b + 1]),
    Math.abs(data[a + 2] - data[b + 2]),
    Math.abs(data[a + 3] - data[b + 3]),
  );
}

/** Square dilation by `radius` pixels, two separable passes over prefix sums. */
function dilateSquare(
  source: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  const horizontal = new Uint8Array(source.length);
  const prefix = new Int32Array(Math.max(width, height) + 1);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) prefix[x + 1] = prefix[x] + source[y * width + x];
    for (let x = 0; x < width; x += 1) {
      const from = Math.max(0, x - radius);
      const to = Math.min(width, x + radius + 1);
      horizontal[y * width + x] = prefix[to] - prefix[from] > 0 ? 1 : 0;
    }
  }
  const out = new Uint8Array(source.length);
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) prefix[y + 1] = prefix[y] + horizontal[y * width + x];
    for (let y = 0; y < height; y += 1) {
      const from = Math.max(0, y - radius);
      const to = Math.min(height, y + radius + 1);
      out[y * width + x] = prefix[to] - prefix[from] > 0 ? 1 : 0;
    }
  }
  return out;
}

/**
 * Scanline flood fill from a seed pixel: every 4-connected pixel within `tolerance` (0-255, the
 * largest channel difference) of the seed color joins the region. Null when the seed is outside
 * the buffer or the region is only a speck.
 *
 * `gap` (pixels) closes openings in the outline: the lines are thickened by that much before the
 * region spreads, so a hand-drawn circle that does not quite meet itself still holds the color,
 * and the region then grows back to the real line edge. A seed too close to a line to start
 * inside the thickened outline falls back to the exact fill.
 */
export function floodFillMask(
  buffer: RgbaBuffer,
  seedX: number,
  seedY: number,
  tolerance: number,
  gap = 0,
): FillMask | null {
  const { data, width, height } = buffer;
  const sx = Math.floor(seedX);
  const sy = Math.floor(seedY);
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return null;
  const seedOffset = (sy * width + sx) * 4;
  const matches = (x: number, y: number) =>
    channelDistance(data, (y * width + x) * 4, seedOffset) <= tolerance;

  let allowed: Uint8Array | null = null;
  if (gap > 0) {
    const blocked = new Uint8Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) if (!matches(x, y)) blocked[y * width + x] = 1;
    }
    const thick = dilateSquare(blocked, width, height, gap);
    if (!thick[sy * width + sx]) {
      allowed = new Uint8Array(thick.length);
      for (let index = 0; index < thick.length; index += 1) allowed[index] = thick[index] ? 0 : 1;
    }
  }
  const open = allowed ? (x: number, y: number) => allowed[y * width + x] === 1 : matches;

  const mask = new Uint8Array(width * height);
  const stack: number[] = [sx, sy];
  let count = 0;
  while (stack.length > 0) {
    const y = stack.pop() as number;
    const x = stack.pop() as number;
    if (mask[y * width + x] || !open(x, y)) continue;
    let left = x;
    while (left > 0 && !mask[y * width + left - 1] && open(left - 1, y)) left -= 1;
    let right = x;
    while (right < width - 1 && !mask[y * width + right + 1] && open(right + 1, y)) right += 1;
    for (let cursor = left; cursor <= right; cursor += 1) mask[y * width + cursor] = 1;
    count += right - left + 1;
    for (const next of [y - 1, y + 1]) {
      if (next < 0 || next >= height) continue;
      let inRun = false;
      for (let cursor = left; cursor <= right; cursor += 1) {
        const free = !mask[next * width + cursor] && open(cursor, next);
        if (free && !inRun) stack.push(cursor, next);
        inRun = free;
      }
    }
  }
  if (allowed) {
    // Grow back over the margin the thickened outline took, up to the real line edge.
    // Eight neighbors, the same square the outline was thickened with, so a closed shape gets
    // back exactly the area the thickening took.
    for (let pass = 0; pass < gap; pass += 1) {
      const grown = mask.slice();
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const index = y * width + x;
          if (mask[index] || !matches(x, y)) continue;
          let next = false;
          for (let dy = -1; dy <= 1 && !next; dy += 1) {
            const ny = y + dy;
            if (ny < 0 || ny >= height) continue;
            for (let dx = -1; dx <= 1; dx += 1) {
              const nx = x + dx;
              if (nx >= 0 && nx < width && mask[ny * width + nx]) {
                next = true;
                break;
              }
            }
          }
          if (next) {
            grown[index] = 1;
            count += 1;
          }
        }
      }
      mask.set(grown);
    }
  }
  if (count < 3) return null;
  let touchesEdge = false;
  for (let x = 0; x < width && !touchesEdge; x += 1) {
    touchesEdge = mask[x] === 1 || mask[(height - 1) * width + x] === 1;
  }
  for (let y = 0; y < height && !touchesEdge; y += 1) {
    touchesEdge = mask[y * width] === 1 || mask[y * width + width - 1] === 1;
  }
  return { mask, width, height, count, touchesEdge };
}

/** Grows the region by `radius` pixels (4-neighborhood) so a fill tucks under its outline. */
export function dilateMask(source: FillMask, radius: number): FillMask {
  let current = source.mask;
  const { width, height } = source;
  for (let pass = 0; pass < radius; pass += 1) {
    const next = current.slice();
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        if (current[index]) continue;
        if (
          (x > 0 && current[index - 1]) ||
          (x < width - 1 && current[index + 1]) ||
          (y > 0 && current[index - width]) ||
          (y < height - 1 && current[index + width])
        ) {
          next[index] = 1;
        }
      }
    }
    current = next;
  }
  let count = 0;
  for (let index = 0; index < current.length; index += 1) if (current[index]) count += 1;
  return { mask: current, width, height, count, touchesEdge: source.touchesEdge };
}

// Edge directions on the pixel-corner grid: 0 right, 1 down, 2 left, 3 up.
const DIR_X = [1, 0, -1, 0];
const DIR_Y = [0, 1, 0, -1];

/**
 * Traces the region's boundary into closed loops of pixel-corner coordinates (flat). The fill
 * sits on the right of every edge, so outer loops and holes both come out and the even-odd rule
 * paints them correctly. Collinear vertices collapse; touching corners split into separate loops.
 */
export function traceMaskLoops(fill: FillMask): number[][] {
  const { mask, width, height } = fill;
  const stride = width + 1;
  const edges = new Uint8Array(stride * (height + 1) * 4);
  const filled = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] === 1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue;
      if (!filled(x, y - 1)) edges[(y * stride + x) * 4 + 0] = 1;
      if (!filled(x + 1, y)) edges[(y * stride + x + 1) * 4 + 1] = 1;
      if (!filled(x, y + 1)) edges[((y + 1) * stride + x + 1) * 4 + 2] = 1;
      if (!filled(x - 1, y)) edges[((y + 1) * stride + x) * 4 + 3] = 1;
    }
  }
  const loops: number[][] = [];
  for (let start = 0; start < edges.length; start += 1) {
    if (edges[start] !== 1) continue;
    const loop: number[] = [];
    let key = Math.floor(start / 4);
    let dir = start % 4;
    let previousDir = -1;
    // The cap bounds a malformed buffer; a real loop closes long before it.
    for (let guard = 0; guard < edges.length; guard += 1) {
      const slot = key * 4 + dir;
      edges[slot] = 2;
      const x = key % stride;
      const y = Math.floor(key / stride);
      if (dir !== previousDir) loop.push(x, y);
      previousDir = dir;
      const nextKey = (y + DIR_Y[dir]) * stride + (x + DIR_X[dir]);
      let chosen = -1;
      for (const turn of [1, 0, 3]) {
        const candidate = (dir + turn) % 4;
        if (edges[nextKey * 4 + candidate] === 1) {
          chosen = candidate;
          break;
        }
      }
      if (chosen < 0) break;
      key = nextKey;
      dir = chosen;
    }
    if (loop.length >= 6) loops.push(loop);
  }
  return loops;
}

function ringArea(ring: readonly number[]): number {
  let area = 0;
  const count = ring.length / 2;
  for (let index = 0, previous = count - 1; index < count; previous = index++) {
    area += ring[previous * 2] * ring[index * 2 + 1] - ring[index * 2] * ring[previous * 2 + 1];
  }
  return Math.abs(area / 2);
}

export interface FillRingsOptions {
  /** Mask pixels per world unit. */
  scale: number;
  /** World position of mask pixel (0,0). */
  originX: number;
  originY: number;
  /** Grow the region this many pixels before tracing. */
  dilate: number;
  /** Simplification tolerance, in mask pixels. */
  epsilon: number;
}

/** Region mask to world-space rings: dilate, trace, drop specks, simplify, keep the biggest. */
export function maskToFillRings(fill: FillMask, options: FillRingsOptions): number[][] {
  const grown = options.dilate > 0 ? dilateMask(fill, options.dilate) : fill;
  const loops = traceMaskLoops(grown)
    .map((loop) => ({ loop, area: ringArea(loop) }))
    .filter(({ area }) => area >= 4)
    .sort((left, right) => right.area - left.area)
    .slice(0, MAX_SKETCH_RINGS_PER_FILL);
  const rings: number[][] = [];
  for (const { loop } of loops) {
    // Close the loop for RDP, then drop the repeated endpoint again.
    const closed = [...loop, loop[0], loop[1]];
    const simplified = simplifyFlatPoints(closed, options.epsilon).slice(0, -2);
    if (simplified.length < 6) continue;
    const ring = new Array<number>(simplified.length);
    for (let index = 0; index < simplified.length; index += 2) {
      ring[index] = options.originX + simplified[index] / options.scale;
      ring[index + 1] = options.originY + simplified[index + 1] / options.scale;
    }
    rings.push(ring);
  }
  return rings;
}
