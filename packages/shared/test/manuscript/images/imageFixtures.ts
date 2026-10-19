import { deflate } from 'pako';
import type { ManuscriptImage } from '../../../manuscript/images/imageInfo';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const be32 = (value: number) => [
  (value >>> 24) & 255,
  (value >>> 16) & 255,
  (value >>> 8) & 255,
  value & 255,
];

function chunk(type: string, data: Uint8Array): number[] {
  const body = Uint8Array.from([...type].map((char) => char.charCodeAt(0)).concat([...data]));
  return [...be32(data.length), ...body, ...be32(crc32(body))];
}

export interface PngSpec {
  width: number;
  height: number;
  /** 0 gray, 2 RGB, 3 palette, 4 gray+alpha, 6 RGBA. */
  colorType: 0 | 2 | 3 | 4 | 6;
  depth?: 1 | 2 | 4 | 8 | 16;
  /** Unfiltered scanline bytes, row after row. */
  rows: number[][];
  /** One PNG filter type per row (default 0 = none). The bytes are filtered here, so decoding must undo them. */
  filters?: number[];
  palette?: number[];
  transparency?: number[];
  interlace?: 0 | 1;
  bytesPerPixel?: number;
}

function filterRow(
  row: number[],
  previous: number[] | null,
  filter: number,
  bytesPerPixel: number,
): number[] {
  return row.map((value, index) => {
    const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
    const up = previous ? previous[index] : 0;
    const upLeft = previous && index >= bytesPerPixel ? previous[index - bytesPerPixel] : 0;
    let predicted = 0;
    if (filter === 1) predicted = left;
    else if (filter === 2) predicted = up;
    else if (filter === 3) predicted = (left + up) >> 1;
    else if (filter === 4) {
      const estimate = left + up - upLeft;
      const pa = Math.abs(estimate - left);
      const pb = Math.abs(estimate - up);
      const pc = Math.abs(estimate - upLeft);
      predicted = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
    }
    return (value - predicted + 256) & 255;
  });
}

export function encodePng(spec: PngSpec): Uint8Array {
  const depth = spec.depth ?? 8;
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[spec.colorType];
  const bytesPerPixel = spec.bytesPerPixel ?? Math.max(1, (channels * depth) / 8);
  const filtered: number[] = [];
  spec.rows.forEach((row, index) => {
    const filter = spec.filters?.[index] ?? 0;
    filtered.push(
      filter,
      ...filterRow(row, index > 0 ? spec.rows[index - 1] : null, filter, bytesPerPixel),
    );
  });
  const header = Uint8Array.from([
    ...be32(spec.width),
    ...be32(spec.height),
    depth,
    spec.colorType,
    0,
    0,
    spec.interlace ?? 0,
  ]);
  const parts = [
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    chunk('IHDR', header),
    ...(spec.palette ? [chunk('PLTE', Uint8Array.from(spec.palette))] : []),
    ...(spec.transparency ? [chunk('tRNS', Uint8Array.from(spec.transparency))] : []),
    chunk('IDAT', deflate(Uint8Array.from(filtered))),
    chunk('IEND', new Uint8Array(0)),
  ];
  return Uint8Array.from(parts.flat());
}

/** An RGBA PNG of one flat colour. */
export function solidPng(
  width: number,
  height: number,
  rgba: [number, number, number, number] = [200, 30, 30, 255],
): ManuscriptImage {
  const rows = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => rgba).flat(),
  );
  return {
    bytes: encodePng({ width, height, colorType: 6, rows }),
    mimeType: 'image/png',
    width,
    height,
  };
}

/** A header-only JPEG: enough for its size and kind, which is all a manuscript reads before handing it on. */
export function jpegOf(
  width: number,
  height: number,
  components: 1 | 3 | 4 = 3,
  adobe = false,
): ManuscriptImage {
  const bytes = [
    0xff,
    0xd8,
    ...(adobe ? [0xff, 0xee, 0x00, 0x0e, 0x41, 0x64, 0x6f, 0x62, 0x65, 0, 100, 0, 0, 0, 0, 0] : []),
    0xff,
    0xc0,
    0x00,
    8 + components * 3,
    8,
    height >> 8,
    height & 255,
    width >> 8,
    width & 255,
    components,
    ...Array.from({ length: components }, (_, index) => [index + 1, 0x11, 0]).flat(),
    0xff,
    0xda,
    0x00,
    0x02,
    0xff,
    0xd9,
  ];
  return { bytes: Uint8Array.from(bytes), mimeType: 'image/jpeg', width, height };
}
