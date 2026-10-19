import { deflate, inflate } from 'pako';
import type { ManuscriptImage } from './imageInfo';

/** A picture as a PDF image XObject wants it: stream bytes plus the dictionary entries that describe them. */
export interface PdfImageData {
  width: number;
  height: number;
  colorSpace: 'DeviceGray' | 'DeviceRGB' | 'DeviceCMYK';
  filter: 'DCTDecode' | 'FlateDecode';
  /** Stream bytes exactly as `filter` reads them. */
  data: Uint8Array;
  /** `/Decode` array text, for the inverted CMYK that Adobe-marked JPEGs carry. */
  decode?: string;
  /** Transparency as its own 8-bit gray image (a PDF soft mask), deflated. */
  softMask?: { data: Uint8Array };
}

const u32 = (bytes: Uint8Array, at: number) =>
  ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;

interface JpegFrame {
  components: number;
  adobe: boolean;
}

function readJpegFrame(bytes: Uint8Array): JpegFrame | null {
  let components: number | null = null;
  let adobe = false;
  let at = 2;
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff) {
      at += 1;
      continue;
    }
    const marker = bytes[at + 1];
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2;
      continue;
    }
    const length = (bytes[at + 2] << 8) | bytes[at + 3];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      components = bytes[at + 9] ?? null;
    }
    // APP14 "Adobe": a 4-component JPEG with it stores inverted CMYK.
    if (marker === 0xee && String.fromCharCode(...bytes.subarray(at + 4, at + 9)) === 'Adobe') {
      adobe = true;
    }
    if (marker === 0xda) break;
    at += 2 + length;
  }
  return components === null ? null : { components, adobe };
}

function jpegImage(image: ManuscriptImage): PdfImageData | null {
  const frame = readJpegFrame(image.bytes);
  if (!frame) return null;
  const colorSpace =
    frame.components === 1
      ? 'DeviceGray'
      : frame.components === 3
        ? 'DeviceRGB'
        : frame.components === 4
          ? 'DeviceCMYK'
          : null;
  if (!colorSpace) return null;
  return {
    width: image.width,
    height: image.height,
    colorSpace,
    filter: 'DCTDecode',
    // The JPEG goes in as it is: a PDF viewer decodes it itself.
    data: image.bytes,
    decode: colorSpace === 'DeviceCMYK' && frame.adobe ? '[1 0 1 0 1 0 1 0]' : undefined,
  };
}

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const distanceLeft = Math.abs(estimate - left);
  const distanceUp = Math.abs(estimate - up);
  const distanceUpLeft = Math.abs(estimate - upLeft);
  if (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft) return left;
  return distanceUp <= distanceUpLeft ? up : upLeft;
}

/** Undoes PNG's per-row filters in place; `null` if a row names a filter that does not exist. */
function unfilter(
  raw: Uint8Array,
  height: number,
  rowBytes: number,
  bytesPerPixel: number,
): Uint8Array | null {
  const out = new Uint8Array(height * rowBytes);
  for (let row = 0; row < height; row += 1) {
    const filter = raw[row * (rowBytes + 1)];
    const source = row * (rowBytes + 1) + 1;
    const target = row * rowBytes;
    const previous = target - rowBytes;
    for (let index = 0; index < rowBytes; index += 1) {
      const value = raw[source + index];
      const left = index >= bytesPerPixel ? out[target + index - bytesPerPixel] : 0;
      const up = row > 0 ? out[previous + index] : 0;
      const upLeft = row > 0 && index >= bytesPerPixel ? out[previous + index - bytesPerPixel] : 0;
      let predicted: number;
      switch (filter) {
        case 0:
          predicted = 0;
          break;
        case 1:
          predicted = left;
          break;
        case 2:
          predicted = up;
          break;
        case 3:
          predicted = (left + up) >> 1;
          break;
        case 4:
          predicted = paeth(left, up, upLeft);
          break;
        default:
          return null;
      }
      out[target + index] = (value + predicted) & 0xff;
    }
  }
  return out;
}

/** One sample of a row as 0..255, whatever the bit depth. */
function sampleReader(depth: number, rowStart: number, bytes: Uint8Array) {
  if (depth === 8) return (index: number) => bytes[rowStart + index];
  if (depth === 16) return (index: number) => bytes[rowStart + index * 2];
  const perByte = 8 / depth;
  const mask = (1 << depth) - 1;
  return (index: number) => {
    const byte = bytes[rowStart + Math.floor(index / perByte)];
    const shift = 8 - depth * ((index % perByte) + 1);
    return (byte >> shift) & mask;
  };
}

function pngImage(image: ManuscriptImage): PdfImageData | null {
  const { bytes, width, height } = image;
  const depth = bytes[24];
  const colorType = bytes[25];
  const interlace = bytes[28];
  const channels = CHANNELS[colorType];
  if (!channels || interlace !== 0 || ![1, 2, 4, 8, 16].includes(depth)) return null;
  if ((colorType === 2 || colorType === 4 || colorType === 6) && depth < 8) return null;

  const idat: Uint8Array[] = [];
  let palette: Uint8Array | null = null;
  let transparency: Uint8Array | null = null;
  for (let at = 8; at + 8 <= bytes.length; ) {
    const length = u32(bytes, at);
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    const body = bytes.subarray(at + 8, at + 8 + length);
    if (type === 'IDAT') idat.push(body);
    else if (type === 'PLTE') palette = body;
    else if (type === 'tRNS') transparency = body;
    else if (type === 'IEND') break;
    at += 12 + length;
  }
  if (idat.length === 0 || (colorType === 3 && !palette)) return null;

  const joined = new Uint8Array(idat.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of idat) {
    joined.set(part, offset);
    offset += part.length;
  }
  let raw: Uint8Array;
  try {
    raw = inflate(joined);
  } catch {
    return null;
  }
  const rowBytes = Math.ceil((width * channels * depth) / 8);
  if (raw.length < height * (rowBytes + 1)) return null;
  const pixels = unfilter(raw, height, rowBytes, Math.max(1, (channels * depth) / 8));
  if (!pixels) return null;

  const grayscale = colorType === 0 || colorType === 4;
  const hasAlpha = colorType === 4 || colorType === 6 || (colorType === 3 && transparency !== null);
  const colorChannels = grayscale ? 1 : 3;
  const color = new Uint8Array(width * height * colorChannels);
  const alpha = hasAlpha ? new Uint8Array(width * height) : null;
  const scale = depth < 8 ? 255 / ((1 << depth) - 1) : 1;

  for (let y = 0; y < height; y += 1) {
    const read = sampleReader(depth, y * rowBytes, pixels);
    for (let x = 0; x < width; x += 1) {
      const out = (y * width + x) * colorChannels;
      if (colorType === 3) {
        const index = read(x);
        color[out] = palette![index * 3] ?? 0;
        color[out + 1] = palette![index * 3 + 1] ?? 0;
        color[out + 2] = palette![index * 3 + 2] ?? 0;
        if (alpha) alpha[y * width + x] = transparency![index] ?? 255;
      } else if (grayscale) {
        color[out] = Math.round(read(x * channels) * scale);
        if (alpha) alpha[y * width + x] = read(x * channels + 1);
      } else {
        color[out] = read(x * channels);
        color[out + 1] = read(x * channels + 1);
        color[out + 2] = read(x * channels + 2);
        if (alpha) alpha[y * width + x] = read(x * channels + 3);
      }
    }
  }

  const opaque = alpha ? alpha.every((value) => value === 255) : true;
  return {
    width,
    height,
    colorSpace: grayscale ? 'DeviceGray' : 'DeviceRGB',
    filter: 'FlateDecode',
    data: deflate(color),
    // A snapshot of a sketch is RGBA even when nothing in it is transparent: an all-opaque mask is dropped.
    softMask: alpha && !opaque ? { data: deflate(alpha) } : undefined,
  };
}

/** The picture as a PDF image, or `null` when this build cannot embed it (an interlaced PNG, a damaged file). */
export function pdfImageOf(image: ManuscriptImage): PdfImageData | null {
  try {
    return image.mimeType === 'image/jpeg' ? jpegImage(image) : pngImage(image);
  } catch {
    return null;
  }
}
