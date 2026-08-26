import JSZip from 'jszip';
import { extensionForMimeType } from '../schemas/GallerySchemas';
import type { FullStoryExportType } from '../schemas/FullStorySchemas';
import type { GalleryType } from '../schemas/GallerySchemas';

/**
 * Packaging a story together with its gallery media, in the shape client and server share.
 *
 * The export JSON has always carried the gallery's *metadata* (title, hash, links) - the gallery
 * tables are part of `FullStoryExportType` like any other entity. What is missing there are the
 * *bytes*: each media file is a separate file, addressed by its hash. This module is only the bridge
 * between the two.
 *
 * Layout of the .zip:
 *   story.json          - the same JSON as the plain export
 *   media/<hash>.<ext>  - each media file the packager managed to resolve
 *
 * It lives in `@keres/shared` because both sides have to produce the *same* file: the app exports
 * from the device (bytes from local disk) and the API publishes to the Showcase (bytes from media
 * storage). Only the resolver changes; the format cannot, or a package downloaded from the site
 * would not import back into the app.
 *
 * No compression (`STORE`): the gallery is mostly image/video/audio, formats that already arrive
 * compressed - running DEFLATE over them would only burn CPU without shrinking anything.
 */

export const STORY_JSON_ENTRY = 'story.json';
export const MEDIA_DIR_PREFIX = 'media/';

/**
 * Returns a media file's bytes, or `null` when the packager does not have that file (not downloaded
 * on the device, or absent from the server's storage).
 */
export type MediaByteResolver = (item: GalleryType) => Promise<Uint8Array | null>;

export interface BuildStoryZipResult {
  bytes: Uint8Array;
  /** How many media files went into the package, out of the total the story references. */
  includedCount: number;
  totalCount: number;
}

/**
 * Builds the .zip bytes for an already-exported story.
 *
 * Media the resolver cannot find is simply left out - the package is still useful with the rest, and
 * the caller receives the count so it can tell the person instead of pretending everything is there.
 */
export async function buildStoryZipBytes(
  storyExport: FullStoryExportType,
  resolve: MediaByteResolver,
): Promise<BuildStoryZipResult> {
  const zip = new JSZip();
  zip.file(STORY_JSON_ENTRY, JSON.stringify(storyExport, null, 2), { compression: 'STORE' });

  const galleryItems: GalleryType[] = storyExport.galleryItems || [];
  let includedCount = 0;

  for (const item of galleryItems) {
    const bytes = await resolve(item);
    if (!bytes) {
      continue;
    }
    const entryName = `${MEDIA_DIR_PREFIX}${item.hash}.${extensionForMimeType(item.mimeType)}`;
    zip.file(entryName, bytes, { compression: 'STORE' });
    includedCount += 1;
  }

  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' });
  return { bytes, includedCount, totalCount: galleryItems.length };
}
