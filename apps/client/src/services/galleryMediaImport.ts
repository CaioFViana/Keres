import type * as DocumentPicker from 'expo-document-picker';
import { mediaFileService, UnsupportedMediaError } from './MediaFileService';
import type { GalleryService } from './storymanagement/GalleryService';

/**
 * The result of importing a batch of files chosen by the person.
 *
 * `galleryIds` covers both new media and resolved duplicates: a caller that needs to
 * link the medium to an entity (the `useEntityGalleryMedia` case) uses this whole
 * list, since a duplicate is still a valid medium to link.
 */
export interface ImportMediaSummary {
  added: number;
  duplicates: number;
  rejected: number;
  galleryIds: string[];
}

/**
 * Imports the files chosen in the system picker into the story's gallery.
 *
 * Media already present (the same hash) does not become a new record: content addressing
 * makes the duplicate detectable, and creating another row would only fill the gallery with copies of the
 * same image. Shared between the gallery screen (a standalone import) and the per-entity media
 * hook (import + link), so the two do not diverge in their dedupe
 * logic.
 */
export async function importPickedMediaAssets(
  galleryService: GalleryService,
  storyId: string,
  userId: string,
  assets: DocumentPicker.DocumentPickerAsset[],
): Promise<ImportMediaSummary> {
  const summary: ImportMediaSummary = { added: 0, duplicates: 0, rejected: 0, galleryIds: [] };

  for (const asset of assets) {
    try {
      const imported = await mediaFileService.importAsset(storyId, asset);
      const existing = await galleryService.getByHash(storyId, imported.hash);

      if (existing) {
        summary.duplicates += 1;
        // The record may exist without a local file (it came from the server and has not been
        // downloaded yet); in that case the file the person has just chosen resolves it.
        if (!mediaFileService.exists(existing.localPath)) {
          await galleryService.setLocalFileState(existing.id, {
            localPath: imported.localPath,
            downloadState: 'downloaded',
            thumbnailPath: imported.thumbnailPath ?? existing.thumbnailPath,
          });
        }
        summary.galleryIds.push(existing.id);
        continue;
      }

      const created = await galleryService.createGallery(userId, {
        storyId,
        mediaType: imported.mediaType,
        mimeType: imported.mimeType,
        fileName: imported.fileName,
        hash: imported.hash,
        sizeBytes: imported.sizeBytes,
        localPath: imported.localPath,
        thumbnailPath: imported.thumbnailPath,
      });
      summary.added += 1;
      summary.galleryIds.push(created.id);
    } catch (importError) {
      if (!(importError instanceof UnsupportedMediaError)) {
        console.log('Failed to import media asset:', importError);
      }
      summary.rejected += 1;
    }
  }

  return summary;
}
