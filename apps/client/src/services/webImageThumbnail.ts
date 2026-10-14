/**
 * Picture thumbnails on web.
 *
 * A browser decodes an `<img>` at the size of the file, not of the cell it is shown in: a gallery grid of twelve-megapixel
 * photos holds about 48 MB of decoded pixels for each one that is on screen. A thumbnail the size of the cell is a
 * few hundred kilobytes decoded. It is made once, written beside the picture under its hash (the address the video
 * thumbnails already use) and shown in every list; the picture itself is only decoded where it is looked at.
 *
 * Everything degrades to `undefined`: a browser without `createImageBitmap`, a file it cannot decode, or a picture that
 * is small enough to be its own thumbnail. The caller then shows the picture itself, as before.
 */

/** Longest side of a thumbnail, in pixels: a grid cell at double density. */
export const IMAGE_THUMBNAIL_MAX_EDGE = 640;
/** JPEG quality of the thumbnail. */
export const IMAGE_THUMBNAIL_JPEG_QUALITY = 0.7;
/**
 * Below this size a picture is shown as it is. Bytes are not pixels (a flat colour compresses to nothing), but a photograph
 * heavy enough to matter is never this small, and a file this small costs nothing to keep decoded.
 */
export const IMAGE_THUMBNAIL_MIN_BYTES = 256 * 1024;

/** Formats a canvas can redraw faithfully: animated or vector pictures keep to the original. */
const THUMBNAILABLE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function wantsImageThumbnail(mimeType: string, sizeBytes: number): boolean {
  return THUMBNAILABLE_MIME_TYPES.has(mimeType) && sizeBytes >= IMAGE_THUMBNAIL_MIN_BYTES;
}

async function drawToJpeg(
  bitmap: ImageBitmap,
  width: number,
  height: number,
): Promise<Blob | null> {
  if (typeof OffscreenCanvas === 'function') {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) return null;
    // JPEG has no transparency: a transparent PNG would come out black.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    return canvas.convertToBlob({ type: 'image/jpeg', quality: IMAGE_THUMBNAIL_JPEG_QUALITY });
  }
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context || typeof canvas.toBlob !== 'function') return null;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', IMAGE_THUMBNAIL_JPEG_QUALITY),
  );
}

/** The thumbnail of a picture as JPEG bytes, or `undefined` when it needs none or cannot be made. */
export async function captureImageThumbnail(source: Blob): Promise<Uint8Array | undefined> {
  if (typeof createImageBitmap !== 'function') {
    return undefined;
  }
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(source);
    const longestSide = Math.max(bitmap.width, bitmap.height);
    // Already no bigger than a thumbnail: the picture is its own.
    if (longestSide <= IMAGE_THUMBNAIL_MAX_EDGE) {
      return undefined;
    }
    const scale = IMAGE_THUMBNAIL_MAX_EDGE / longestSide;
    const jpeg = await drawToJpeg(
      bitmap,
      Math.max(1, Math.round(bitmap.width * scale)),
      Math.max(1, Math.round(bitmap.height * scale)),
    );
    return jpeg ? new Uint8Array(await jpeg.arrayBuffer()) : undefined;
  } catch {
    return undefined;
  } finally {
    // The full-size decode is the one expensive thing here: let it go at once.
    bitmap?.close();
  }
}
