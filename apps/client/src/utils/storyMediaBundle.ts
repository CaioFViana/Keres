import type { FullStoryExportType } from '@keres/shared';
import {
  buildStoryZipBytes as buildSharedStoryZipBytes,
  FullStoryExportSchema,
  MEDIA_DIR_PREFIX,
  migrateStoryExport,
  STORY_JSON_ENTRY,
  StoryExportVersionError,
} from '@keres/shared';
import { File } from 'expo-file-system';
import JSZip from 'jszip';
import { mediaFileService } from '../services/MediaFileService';
import { reviveDates } from './reviveDates';
import { StoryImportError } from './StoryImportError';

/**
 * Removes a UTF-8 BOM (`﻿`) from the start of the text, if there is one.
 *
 * `Blob.text()` (used in the web picker's import) already discards the BOM by specification,
 * but `expo-file-system`'s `File.text()` (used in the native import) does not document that
 * behaviour - without this, the same `.json`/`.zip` file (for instance, one re-exported by
 * a text editor that adds a BOM) would import on the web and fail with "Unexpected token"
 * on the device.
 */
export function stripUtf8Bom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export interface BuildZipResult {
  bytes: Uint8Array;
  /** How many media entered the package, out of the total the story references. */
  includedCount: number;
  totalCount: number;
}

/**
 * Packages a story with the gallery's media, or reads one of those packages back.
 *
 * The .zip's format (and the assembly step) lives in `@keres/shared` - `buildStoryZipBytes`
 * there - because the API produces exactly the same file when publishing a story to the Showcase.
 * What belongs to the app and stays here: where the bytes come from (the device's disk, through
 * `mediaFileService`) and the reading back, which only the app does.
 */

/**
 * Assembles the .zip bytes for an already exported story (`storyService.exportFullStory`).
 *
 * Media not downloaded on this device (a null `localPath`, or the file has vanished) is
 * simply left out - the package is still useful with the rest, and the caller gets the
 * count so as to warn the person instead of pretending everything is there.
 */
export async function buildStoryZipBytes(
  storyExport: FullStoryExportType,
  storyId: string,
): Promise<BuildZipResult> {
  return buildSharedStoryZipBytes(storyExport, async (item) => {
    const localPath = mediaFileService.localPathFor(storyId, item.hash, item.mimeType);
    if (!mediaFileService.exists(localPath)) {
      return null;
    }
    return await new File(localPath).bytes();
  });
}

export interface ExtractedZipMedia {
  hash: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface ExtractedStoryZip {
  story: FullStoryExportType;
  media: ExtractedZipMedia[];
}

/**
 * Reads a .zip produced by `buildStoryZipBytes` back into memory.
 *
 * Each extracted medium's mime type comes from `story.json` (indexed by hash), not from the
 * file's extension inside the .zip - the extension exists only so the file has a
 * readable name, `extensionForMimeType` is already not necessarily 1:1 (heic/heif, jpg/jpeg).
 */
export async function extractStoryZip(
  bytes: Uint8Array,
  sourceName: string,
): Promise<ExtractedStoryZip> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch (error) {
    throw new StoryImportError(
      'unreadable',
      `Could not open ${sourceName} as a zip file: ${(error as Error)?.message}`,
    );
  }

  const storyEntry = zip.file(STORY_JSON_ENTRY);
  if (!storyEntry) {
    throw new StoryImportError(
      'invalid_format',
      `${sourceName} does not contain a ${STORY_JSON_ENTRY} entry.`,
    );
  }

  let parsedJson: unknown;
  try {
    // `JSON.parse` never revives a `Date` - the same care as `pickStoryExportFile` with the loose
    // `.json`, otherwise the validation below would reject every date as a string.
    parsedJson = reviveDates(JSON.parse(stripUtf8Bom(await storyEntry.async('string'))));
  } catch {
    throw new StoryImportError(
      'invalid_format',
      `${sourceName}'s ${STORY_JSON_ENTRY} is not valid JSON.`,
    );
  }

  let migrated: unknown;
  try {
    migrated = migrateStoryExport(parsedJson);
  } catch (error) {
    if (error instanceof StoryExportVersionError) {
      throw new StoryImportError('future_format_version', error.message);
    }
    throw error;
  }

  const validation = FullStoryExportSchema.safeParse(migrated);
  if (!validation.success) {
    throw new StoryImportError(
      'invalid_format',
      `${sourceName} is not a Keres story export: ${validation.error.message}`,
    );
  }

  const story = validation.data;
  const mimeTypeByHash = new Map(
    (story.galleryItems || []).map((item) => [item.hash, item.mimeType]),
  );

  const media: ExtractedZipMedia[] = [];
  const mediaEntries = zip.file(new RegExp(`^${MEDIA_DIR_PREFIX}`));
  for (const entry of mediaEntries) {
    if (entry.dir) {
      continue;
    }
    const hash = entry.name.slice(MEDIA_DIR_PREFIX.length).split('.')[0];
    const mimeType = mimeTypeByHash.get(hash);
    if (!mimeType) {
      // An entry story.json does not reference (a tampered package, or one from a different
      // version); ignore it instead of failing the whole import because of it.
      continue;
    }
    media.push({ hash, mimeType, bytes: await entry.async('uint8array') });
  }

  return { story, media };
}
