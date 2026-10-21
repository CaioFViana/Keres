import type { FullStoryExportType } from '@keres/shared';
import type { AppDrizzleClient } from '@/src/db';
import { mediaFileService } from '@/src/services/media/MediaFileService';
import { extractStoryZip } from '@/src/services/media/storyMediaBundle';
import { createULID } from '@/src/utils/entity/entityUtils';
import { createStoryService } from './StoryService';

/** A story read out of a package: its data and the bytes of the media it carries (none for a `.json`). */
export interface StoryImportSource {
  story: FullStoryExportType;
  media: { hash: string; mimeType: string; bytes: Uint8Array }[];
}

/**
 * Makes a local copy of a story read from a package - whether picked from a file or downloaded from a
 * server's public site.
 *
 * The importer inserts with remade ids, so the copy is a story of its own and can also restore a parallel
 * backup. The package's media files are written into the device's storage before the records are created:
 * the gallery is born with the local file, without depending on synchronizing with a server later. The copy
 * is local (no server): linking it to one is a separate decision, made on the story selection screen.
 */
export async function importStoryFromSource(
  db: AppDrizzleClient,
  userId: string,
  { story, media }: StoryImportSource,
): Promise<{ storyId: string; title: string }> {
  const storyId = createULID();
  const localMediaPaths = new Map<string, string>();
  for (const item of media) {
    const localPath = await mediaFileService.writeDownloaded(
      storyId,
      item.hash,
      item.mimeType,
      item.bytes,
    );
    localMediaPaths.set(item.hash, localPath);
  }
  await createStoryService(db).importFullStory(userId, story, null, null, localMediaPaths, storyId);
  return { storyId, title: story.story.title };
}

/** The same, from the bytes of a Keres package (`.zip`) already in memory. `sourceName` is for error messages. */
export async function importStoryZipBytes(
  db: AppDrizzleClient,
  userId: string,
  bytes: Uint8Array,
  sourceName: string,
): Promise<{ storyId: string; title: string }> {
  return importStoryFromSource(db, userId, await extractStoryZip(bytes, sourceName));
}
