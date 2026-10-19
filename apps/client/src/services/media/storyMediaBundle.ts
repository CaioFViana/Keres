import type { FullStoryExportType } from '@keres/shared';
import type {
  BuildStoryZipResult,
  ExtractedStoryZip,
  ExtractedStoryZipMedia,
} from '@keres/shared/utils/storyZip';
import { File } from 'expo-file-system';
import { mediaFileService } from '@/src/services/media/MediaFileService';
import { StoryImportError } from '@/src/utils/io/StoryImportError';

export type BuildZipResult = BuildStoryZipResult;
export type ExtractedZipMedia = ExtractedStoryZipMedia;

/** The archive code carries `jszip`: it loads when a story is packaged or opened, not when the app starts. */
const storyZip = () => import('@keres/shared/utils/storyZip');

/**
 * Packages a story with the gallery's media and adapts shared archive errors to client errors.
 *
 * The .zip's format (and the assembly step) lives in `@keres/shared` - `buildStoryZipBytes`
 * there - because the API produces exactly the same file when publishing a story to the Showcase.
 * What belongs to the app and stays here is where the bytes come from: the device's disk, through
 * `mediaFileService`. Reading and validating the archive is portable and also lives in `shared`.
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
  const { buildStoryZipBytes: buildSharedStoryZipBytes } = await storyZip();
  return buildSharedStoryZipBytes(storyExport, async (item) => {
    const localPath = mediaFileService.localPathFor(storyId, item.hash, item.mimeType);
    if (!mediaFileService.exists(localPath)) {
      return null;
    }
    return await new File(localPath).bytes();
  });
}

/** Reads a shared story archive and turns its portable error into one the app can present. */
export async function extractStoryZip(
  bytes: Uint8Array,
  sourceName: string,
): Promise<ExtractedStoryZip> {
  const { extractStoryZip: extractSharedStoryZip, StoryZipReadError } = await storyZip();
  try {
    return await extractSharedStoryZip(bytes, sourceName);
  } catch (error) {
    if (error instanceof StoryZipReadError) {
      throw new StoryImportError(error.reason, error.message);
    }
    throw error;
  }
}
