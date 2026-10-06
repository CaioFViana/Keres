/** The only bitmap kinds a manuscript embeds: what a Sketch snapshot (PNG) or a camera roll (JPEG) holds. */
export type ManuscriptImageMime = 'image/png' | 'image/jpeg';

export interface ManuscriptImageInfo {
  mimeType: ManuscriptImageMime;
  width: number;
  height: number;
}

/** A picture ready to place: its bytes, its kind and its size in pixels. */
export interface ManuscriptImage extends ManuscriptImageInfo {
  bytes: Uint8Array;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const u32 = (bytes: Uint8Array, at: number) =>
  ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
const u16 = (bytes: Uint8Array, at: number) => (bytes[at] << 8) | bytes[at + 1];

function pngInfo(bytes: Uint8Array): ManuscriptImageInfo | null {
  if (bytes.length < 24 || !PNG_SIGNATURE.every((value, index) => bytes[index] === value)) {
    return null;
  }
  // The IHDR chunk is always first: length(4) "IHDR"(4) width(4) height(4).
  if (u32(bytes, 8) !== 13 || String.fromCharCode(...bytes.subarray(12, 16)) !== 'IHDR') {
    return null;
  }
  const width = u32(bytes, 16);
  const height = u32(bytes, 20);
  return width > 0 && height > 0 ? { mimeType: 'image/png', width, height } : null;
}

/** Start-of-frame markers carry the size; C4 (huffman), C8 (reserved) and CC (arithmetic) do not. */
const isStartOfFrame = (marker: number) =>
  marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

function jpegInfo(bytes: Uint8Array): ManuscriptImageInfo | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let at = 2;
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff) {
      at += 1;
      continue;
    }
    const marker = bytes[at + 1];
    // Fill bytes and standalone markers have no length.
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2;
      continue;
    }
    const length = u16(bytes, at + 2);
    if (isStartOfFrame(marker)) {
      if (at + 9 > bytes.length) return null;
      const height = u16(bytes, at + 5);
      const width = u16(bytes, at + 7);
      return width > 0 && height > 0 ? { mimeType: 'image/jpeg', width, height } : null;
    }
    // Start of scan: the entropy-coded data follows and no frame header is left to find.
    if (marker === 0xda) return null;
    at += 2 + length;
  }
  return null;
}

/** What a picture is and how big, from its own header; `null` for anything a manuscript cannot embed. */
export function readImageInfo(bytes: Uint8Array): ManuscriptImageInfo | null {
  return pngInfo(bytes) ?? jpegInfo(bytes);
}
