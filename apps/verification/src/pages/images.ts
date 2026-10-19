/**
 * What a person may send, decided by the bytes and not by the name or the type the browser claims: JPEG, PNG and WebP
 * only, by their magic numbers. HTML, SVG (which starts as text), GIF, PDF, HEIC and anything else are refused here,
 * so the reviewer is never shown a file that is not one of these. The same sniff runs again when a reviewer views an
 * image, so the content type that is served is the one the bytes have.
 */

export type ImageType = 'image/jpeg' | 'image/png' | 'image/webp';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

export function sniffImage(bytes: Uint8Array): ImageType | undefined {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.length >= PNG_SIGNATURE.length && PNG_SIGNATURE.every((byte, i) => bytes[i] === byte)) {
    return 'image/png';
  }
  // RIFF <size> WEBP: the size in between is not checked; the decoder on the reviewer's side reads what is there.
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return undefined;
}
