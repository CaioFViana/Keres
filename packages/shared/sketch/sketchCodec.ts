import { deflate, Inflate } from 'pako';
import { base64ToBytes, bytesToBase64 } from '../utils/base64';
import {
  MAX_SKETCH_ITEMS_PER_LAYER,
  MAX_SKETCH_LAYER_DECODED_BYTES,
  MAX_SKETCH_POINTS_PER_RING,
  MAX_SKETCH_POINTS_PER_STROKE,
  MAX_SKETCH_RINGS_PER_FILL,
  SKETCH_BRUSH_IDS,
  SKETCH_QUANT,
  type SketchFill,
  type SketchItem,
  type SketchStroke,
} from './sketchTypes';

/**
 * Wire format of one layer's items: a compact binary stream (varints, delta-coded quarter-pixel
 * coordinates), deflated, then base64. A typical stroke costs a few hundred bytes, so a busy
 * page stays in the hundreds of KB inside the sketch's own JSON instead of becoming a bitmap.
 *
 * Byte layout (before deflate):
 *   u8 format(1) | varint itemCount | items...
 *   stroke: u8 0 | u8 brush | u8 r g b | u8 alpha | varint size*4 | varint n | n points (delta)
 *   fill:   u8 1 | u8 r g b | u8 alpha | varint rings | per ring: varint n | n points (delta)
 * Points are `zigzag(Δx*4)`, `zigzag(Δy*4)`; the first point of a stroke/ring is relative to 0,0.
 */

const FORMAT_VERSION = 1;
const KIND_STROKE = 0;
const KIND_FILL = 1;

export class SketchCodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SketchCodecError';
  }
}

/** Rounds to the stored resolution; the editor normalizes with it so round trips are exact. */
export function quantizeSketchValue(value: number): number {
  return Math.round(value * SKETCH_QUANT) / SKETCH_QUANT;
}

export function quantizeSketchAlpha(alpha: number): number {
  return Math.round(Math.min(1, Math.max(0, alpha)) * 255) / 255;
}

// ---------------------------------------------------------------- byte stream

class ByteWriter {
  private buffer = new Uint8Array(4096);
  private length = 0;

  private ensure(extra: number) {
    if (this.length + extra <= this.buffer.length) return;
    let size = this.buffer.length * 2;
    while (size < this.length + extra) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buffer.subarray(0, this.length));
    this.buffer = next;
  }

  byte(value: number) {
    this.ensure(1);
    this.buffer[this.length++] = value & 255;
  }

  /** Unsigned LEB128 over safe integers (no 32-bit bit ops, so large values stay exact). */
  varint(value: number) {
    let remaining = value;
    this.ensure(10);
    while (remaining >= 128) {
      this.buffer[this.length++] = (remaining % 128) | 128;
      remaining = Math.floor(remaining / 128);
    }
    this.buffer[this.length++] = remaining;
  }

  signed(value: number) {
    this.varint(value >= 0 ? value * 2 : -value * 2 - 1);
  }

  result(): Uint8Array {
    return this.buffer.slice(0, this.length);
  }
}

class ByteReader {
  private position = 0;

  constructor(private readonly bytes: Uint8Array) {}

  byte(): number {
    if (this.position >= this.bytes.length) throw new SketchCodecError('Unexpected end of data.');
    return this.bytes[this.position++];
  }

  varint(): number {
    let result = 0;
    let multiplier = 1;
    for (let count = 0; count < 9; count += 1) {
      const value = this.byte();
      result += (value & 127) * multiplier;
      if (value < 128) return result;
      multiplier *= 128;
    }
    throw new SketchCodecError('Varint is too long.');
  }

  signed(): number {
    const value = this.varint();
    return value % 2 === 0 ? value / 2 : -(value + 1) / 2;
  }

  get done(): boolean {
    return this.position >= this.bytes.length;
  }
}

function writeColor(writer: ByteWriter, color: string, alpha: number) {
  const match = /^#([0-9a-fA-F]{6})$/.exec(color);
  if (!match) throw new SketchCodecError(`Invalid sketch color: ${color}`);
  const value = Number.parseInt(match[1], 16);
  writer.byte((value >> 16) & 255);
  writer.byte((value >> 8) & 255);
  writer.byte(value & 255);
  writer.byte(Math.round(Math.min(1, Math.max(0, alpha)) * 255));
}

function readColor(reader: ByteReader): { color: string; alpha: number } {
  const r = reader.byte();
  const g = reader.byte();
  const b = reader.byte();
  const alpha = reader.byte() / 255;
  const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  return { color: `#${hex}`, alpha };
}

function writePoints(writer: ByteWriter, points: readonly number[]) {
  const count = Math.floor(points.length / 2);
  writer.varint(count);
  let lastX = 0;
  let lastY = 0;
  for (let index = 0; index < count; index += 1) {
    const x = Math.round(points[index * 2] * SKETCH_QUANT);
    const y = Math.round(points[index * 2 + 1] * SKETCH_QUANT);
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) {
      throw new SketchCodecError('Sketch coordinate is out of range.');
    }
    writer.signed(x - lastX);
    writer.signed(y - lastY);
    lastX = x;
    lastY = y;
  }
}

function readPoints(reader: ByteReader, limit: number): number[] {
  const count = reader.varint();
  if (count > limit) throw new SketchCodecError('Too many points in one path.');
  const points = new Array<number>(count * 2);
  let x = 0;
  let y = 0;
  for (let index = 0; index < count; index += 1) {
    x += reader.signed();
    y += reader.signed();
    points[index * 2] = x / SKETCH_QUANT;
    points[index * 2 + 1] = y / SKETCH_QUANT;
  }
  return points;
}

// ---------------------------------------------------------------- items

export function encodeSketchItemsRaw(items: readonly SketchItem[]): Uint8Array {
  if (items.length > MAX_SKETCH_ITEMS_PER_LAYER) {
    throw new SketchCodecError('Too many items in one layer.');
  }
  const writer = new ByteWriter();
  writer.byte(FORMAT_VERSION);
  writer.varint(items.length);
  for (const item of items) {
    if (item.kind === 'stroke') {
      writer.byte(KIND_STROKE);
      writer.byte(SKETCH_BRUSH_IDS.indexOf(item.brush));
      writeColor(writer, item.color, item.alpha);
      writer.varint(Math.max(1, Math.round(item.size * SKETCH_QUANT)));
      writePoints(writer, item.points);
    } else {
      writer.byte(KIND_FILL);
      writeColor(writer, item.color, item.alpha);
      writer.varint(item.rings.length);
      for (const ring of item.rings) writePoints(writer, ring);
    }
  }
  return writer.result();
}

export function decodeSketchItemsRaw(bytes: Uint8Array): SketchItem[] {
  const reader = new ByteReader(bytes);
  if (reader.byte() !== FORMAT_VERSION) throw new SketchCodecError('Unsupported sketch format.');
  const count = reader.varint();
  if (count > MAX_SKETCH_ITEMS_PER_LAYER)
    throw new SketchCodecError('Too many items in one layer.');
  const items: SketchItem[] = [];
  for (let index = 0; index < count; index += 1) {
    const kind = reader.byte();
    if (kind === KIND_STROKE) {
      const brush = SKETCH_BRUSH_IDS[reader.byte()];
      if (!brush) throw new SketchCodecError('Unknown brush.');
      const { color, alpha } = readColor(reader);
      const size = reader.varint() / SKETCH_QUANT;
      const points = readPoints(reader, MAX_SKETCH_POINTS_PER_STROKE);
      if (points.length < 2) throw new SketchCodecError('A stroke needs a point.');
      const stroke: SketchStroke = { kind: 'stroke', brush, color, alpha, size, points };
      items.push(stroke);
    } else if (kind === KIND_FILL) {
      const { color, alpha } = readColor(reader);
      const ringCount = reader.varint();
      if (ringCount > MAX_SKETCH_RINGS_PER_FILL) throw new SketchCodecError('Too many rings.');
      const rings: number[][] = [];
      for (let ring = 0; ring < ringCount; ring += 1) {
        rings.push(readPoints(reader, MAX_SKETCH_POINTS_PER_RING));
      }
      const fill: SketchFill = { kind: 'fill', color, alpha, rings };
      items.push(fill);
    } else {
      throw new SketchCodecError('Unknown item kind.');
    }
  }
  if (!reader.done) throw new SketchCodecError('Trailing bytes after the last item.');
  return items;
}

/** One layer's items as the string stored in the sketch JSON; an empty layer is `''`. */
export function encodeSketchItems(items: readonly SketchItem[]): string {
  if (items.length === 0) return '';
  return bytesToBase64(deflate(encodeSketchItemsRaw(items), { level: 6 }));
}

/**
 * Inflates with a hard output ceiling: the server runs this on untrusted input, and a few KB of
 * deflate can expand to gigabytes. The ceiling is enforced as chunks arrive, not afterwards.
 */
export function inflateSketchBytes(
  compressed: Uint8Array,
  maxBytes = MAX_SKETCH_LAYER_DECODED_BYTES,
): Uint8Array {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const inflater = new Inflate();
  inflater.onData = (chunk: Uint8Array) => {
    total += chunk.length;
    if (total > maxBytes)
      throw new SketchCodecError('Sketch layer expands beyond the allowed size.');
    chunks.push(chunk);
  };
  try {
    inflater.push(compressed, true);
  } catch (error) {
    if (error instanceof SketchCodecError) throw error;
    throw new SketchCodecError('Sketch layer data is corrupt.');
  }
  if (inflater.err) throw new SketchCodecError('Sketch layer data is corrupt.');
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export function decodeSketchItems(data: string): SketchItem[] {
  if (data === '') return [];
  let compressed: Uint8Array;
  try {
    compressed = base64ToBytes(data);
  } catch {
    throw new SketchCodecError('Invalid base64 data.');
  }
  return decodeSketchItemsRaw(inflateSketchBytes(compressed));
}
