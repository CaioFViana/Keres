import type { SketchContentType } from '../schemas/SketchSchemas';

/*
 * A sketch's snapshot is a PNG of its drawing kept in the Gallery (the sketch's cover). A manuscript shows
 * that PNG, so it has to be of the drawing as it is now. The sketch records *which drawing* its snapshot is
 * of - a hash of the content - and the snapshot is fresh exactly when that hash still matches. A hash of the
 * content, not a date: a drawing edited and put back is the same drawing, and a date would call it stale.
 */

/** JSON with sorted keys, so the same drawing hashes the same wherever its JSON was last re-ordered. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`);
  return `{${entries.join(',')}}`;
}

/** 53-bit FNV-1a style hash as 14 hex digits: compact, stable, and plenty to tell two drawings apart. */
function hash53(text: string): string {
  let high = 0x811c9dc5;
  let low = 0x01000193;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    high = Math.imul(high ^ code, 0x01000193) >>> 0;
    low = Math.imul(low ^ (code << 1), 0x85ebca6b) >>> 0;
  }
  const value = (high & 0x1fffff) * 0x100000000 + low;
  return value.toString(16).padStart(14, '0');
}

/** The identity of a drawing: layers, page and overlays, whatever order their keys came in. */
export function sketchContentHash(content: SketchContentType): string {
  return hash53(canonicalJson(content));
}

/** Whether the sketch's snapshot is of the drawing as it is now. */
export function isSketchSnapshotFresh(sketch: {
  content: SketchContentType;
  coverGalleryId: string | null;
  coverSourceHash: string | null;
}): boolean {
  return (
    sketch.coverGalleryId !== null &&
    sketch.coverSourceHash !== null &&
    sketch.coverSourceHash === sketchContentHash(sketch.content)
  );
}
