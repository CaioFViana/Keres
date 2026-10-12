import type { BlobRole } from '../../store/submissions';
import { type ImageType, sniffImage } from '../images';
import type { UploadRefusal } from '../uploadMessages';

/**
 * What one upload may hold and how it is read. The form has three fields: `front` (required), `back` (optional) and
 * `photo` (the live photo, required). Any other field is refused, and so is a second file in a field. Every image
 * must be JPEG, PNG or WebP by its bytes and at most the per-image limit; the total is capped too. Nothing here
 * stores anything: it returns the bytes of a valid upload, or the one reason it is not.
 */

const FIELD_ROLES: Record<string, BlobRole> = {
  front: 'document-front',
  back: 'document-back',
  photo: 'photo',
};

/** Multipart framing is not image data; this is how much more than the images a request may carry. */
export const FORM_OVERHEAD_BYTES = 64 * 1024;

/** Three images at most (front, back, photo), so the total is three times the per-image limit. */
export const totalUploadBytes = (maxImageBytes: number): number => maxImageBytes * 3;

export interface ReadImage {
  role: BlobRole;
  bytes: Uint8Array;
  contentType: ImageType;
}

export type UploadReading =
  | { ok: true; images: ReadImage[] }
  | { ok: false; refusal: UploadRefusal };

const refuse = (refusal: UploadRefusal): UploadReading => ({ ok: false, refusal });

/** A limit in megabytes for the page's text (one decimal at most). */
export function imageMegabytes(bytes: number): string {
  return String(Math.round((bytes / (1024 * 1024)) * 10) / 10);
}

/**
 * Reads the form. Files are checked by size before any is read into memory, then by their bytes. The order of the
 * images in the result is the order of the fields: front, back, photo.
 */
export async function readUpload(form: FormData, maxImageBytes: number): Promise<UploadReading> {
  const files = new Map<string, File>();
  // Names and values are read one field at a time: the entries iterator is typed as text, which a file is not.
  for (const name of new Set(form.keys())) {
    if (!Object.prototype.hasOwnProperty.call(FIELD_ROLES, name)) return refuse('unexpected_field');
    const values = form.getAll(name);
    if (values.length > 1) return refuse('too_many');
    const value = values[0];
    // A file input left empty still sends a part: it is no file at all, whether the parser reads it as an empty file
    // or as an empty text value.
    if (typeof value === 'string') {
      if (value === '') continue;
      return refuse('bad_request');
    }
    if (value.size === 0) continue;
    files.set(name, value);
  }
  if (!files.has('front')) return refuse('missing_front');
  if (!files.has('photo')) return refuse('missing_photo');

  let total = 0;
  for (const file of files.values()) {
    if (file.size > maxImageBytes) return refuse('too_large');
    total += file.size;
  }
  if (total > totalUploadBytes(maxImageBytes)) return refuse('too_large');

  const images: ReadImage[] = [];
  for (const name of ['front', 'back', 'photo']) {
    const file = files.get(name);
    if (!file) continue;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = sniffImage(bytes);
    if (!contentType) return refuse('not_an_image');
    images.push({ role: FIELD_ROLES[name] as BlobRole, bytes, contentType });
  }
  return { ok: true, images };
}
