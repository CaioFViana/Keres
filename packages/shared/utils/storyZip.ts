import JSZip from 'jszip';
import { extensionForMimeType, galleryHasFile } from '../schemas/GallerySchemas';
import { FullStoryExportSchema, type FullStoryExportType } from '../schemas/FullStorySchemas';
import type { GalleryType } from '../schemas/GallerySchemas';
import { migrateStoryExport, StoryExportVersionError } from '../schemas/storyExportMigrations';
import { reviveDates } from './reviveDates';

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

/** Removes a UTF-8 BOM from the start of JSON text, if present. */
export function stripUtf8Bom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

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

export interface ExtractedStoryZipMedia {
  hash: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface ExtractedStoryZip {
  story: FullStoryExportType;
  media: ExtractedStoryZipMedia[];
}

export type StoryZipReadErrorReason = 'unreadable' | 'invalid_format' | 'future_format_version';

/** A portable error for a ZIP that cannot be imported as a Keres story package. */
export class StoryZipReadError extends Error {
  constructor(
    readonly reason: StoryZipReadErrorReason,
    message: string,
  ) {
    super(message);
    this.name = 'StoryZipReadError';
  }
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

  const galleryItems: GalleryType[] = (storyExport.galleryItems || []).filter((item) =>
    galleryHasFile(item.mediaType),
  );
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

/**
 * Reads a Keres story archive produced by {@link buildStoryZipBytes}.
 *
 * MIME types come from `story.json`, never from the extension stored in the archive: extensions
 * are only human-readable labels and are not one-to-one for formats such as HEIC/JPEG.
 */
export async function extractStoryZip(
  bytes: Uint8Array,
  sourceName: string,
): Promise<ExtractedStoryZip> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch (error) {
    throw new StoryZipReadError(
      'unreadable',
      `Could not open ${sourceName} as a zip file: ${(error as Error)?.message}`,
    );
  }

  const storyEntry = zip.file(STORY_JSON_ENTRY);
  if (!storyEntry) {
    throw new StoryZipReadError(
      'invalid_format',
      `${sourceName} does not contain a ${STORY_JSON_ENTRY} entry.`,
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = reviveDates(JSON.parse(stripUtf8Bom(await storyEntry.async('string'))));
  } catch {
    throw new StoryZipReadError(
      'invalid_format',
      `${sourceName}'s ${STORY_JSON_ENTRY} is not valid JSON.`,
    );
  }

  let migrated: unknown;
  try {
    migrated = migrateStoryExport(parsedJson);
  } catch (error) {
    if (error instanceof StoryExportVersionError) {
      throw new StoryZipReadError('future_format_version', error.message);
    }
    throw error;
  }

  const validation = FullStoryExportSchema.safeParse(migrated);
  if (!validation.success) {
    throw new StoryZipReadError(
      'invalid_format',
      `${sourceName} is not a Keres story export: ${validation.error.message}`,
    );
  }

  const story = validation.data;
  const mimeTypeByHash = new Map(
    (story.galleryItems || []).map((item) => [item.hash, item.mimeType]),
  );
  const media: ExtractedStoryZipMedia[] = [];
  const mediaEntries = zip.file(new RegExp(`^${MEDIA_DIR_PREFIX}`));
  for (const entry of mediaEntries) {
    if (entry.dir) {
      continue;
    }
    const hash = entry.name.slice(MEDIA_DIR_PREFIX.length).split('.')[0];
    const mimeType = mimeTypeByHash.get(hash);
    if (mimeType) {
      media.push({ hash, mimeType, bytes: await entry.async('uint8array') });
    }
  }

  return { story, media };
}
