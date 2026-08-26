import type { MediaBlobStatusResponseType } from '@keres/shared';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import type { AppDrizzleClient } from '../db';
import type { GallerySelect, ServerSelect } from '../db/schema';
import type { KeresAxiosInstance } from './apiClient';
import { getServerAccessToken, isOfflineError } from './apiClient';
import { mediaFileService } from './MediaFileService';
import type { GalleryService } from './storymanagement/GalleryService';
import { createGalleryService } from './storymanagement/GalleryService';

/**
 * The gallery's binary channel.
 *
 * A medium's metadata travels through the operation log like any other entity;
 * sending a video's bytes down the same path is not viable, so they go up and down
 * through routes of their own, addressed by the content's hash.
 *
 * The hash is what makes this cheap: before uploading anything we ask the server
 * which hashes it already has, and what it already has does not go up again - including when somebody
 * else has already uploaded exactly the same file. It is also what answers "has it changed?": different
 * content is a different hash, and a different hash is a different record.
 */

/** How many blobs to transfer per cycle, so a sync cycle does not become a long upload. */
const MAX_TRANSFERS_PER_CYCLE = 5;

export interface MediaSyncSummary {
  uploaded: number;
  downloaded: number;
  failed: number;
  /** True when the server did not answer; the cycle should treat it as offline. */
  offline: boolean;
}

export class MediaSyncService {
  private galleryService: GalleryService;

  constructor(db: AppDrizzleClient) {
    this.galleryService = createGalleryService(db);
  }

  /**
   * Reconciles a story's files with the server.
   *
   * It never throws on a transfer failure: a medium that did not upload stays marked as
   * pending and is retried on the following cycle. One large video failing must not bring down the
   * text synchronization of a whole story.
   */
  async syncStoryMedia(
    client: KeresAxiosInstance,
    server: ServerSelect,
    storyId: string,
  ): Promise<MediaSyncSummary> {
    const summary: MediaSyncSummary = { uploaded: 0, downloaded: 0, failed: 0, offline: false };

    try {
      await this.uploadPending(client, storyId, summary);
      await this.downloadMissing(client, server, storyId, summary);
    } catch (error) {
      if (isOfflineError(error)) {
        summary.offline = true;
        return summary;
      }
      console.log(`MediaSyncService: media sync for story ${storyId} did not complete.`, error);
    }

    return summary;
  }

  private async uploadPending(
    client: KeresAxiosInstance,
    storyId: string,
    summary: MediaSyncSummary,
  ): Promise<void> {
    const pending = await this.galleryService.getPendingUploads(storyId);
    if (pending.length === 0) {
      return;
    }

    // A blob the server already has does not need uploading - either because an earlier send
    // arrived and the response was lost, or because somebody else uploaded the same file.
    const status = await this.fetchBlobStatus(
      client,
      storyId,
      pending.map((media) => media.hash),
    );
    const alreadyPresent = new Set(status.present);

    const toUpload: GallerySelect[] = [];
    for (const media of pending) {
      if (alreadyPresent.has(media.hash)) {
        await this.galleryService.setLocalFileState(media.id, { uploadState: 'uploaded' });
        continue;
      }
      toUpload.push(media);
    }

    for (const media of toUpload.slice(0, MAX_TRANSFERS_PER_CYCLE)) {
      if (!mediaFileService.exists(media.localPath)) {
        // The record exists but the file has vanished from this device (a system cleanup,
        // a reinstall). There is nothing to upload; it becomes a download case.
        console.warn(
          `MediaSyncService: local file missing for gallery ${media.id}; will try to download instead.`,
        );
        await this.galleryService.setLocalFileState(media.id, {
          localPath: null,
          uploadState: 'uploaded',
          downloadState: 'pending',
        });
        continue;
      }

      try {
        const form = new FormData();
        if (Platform.OS === 'web') {
          // There is no web equivalent for React Native's `{uri, name, type}` "file" -
          // FormData on the web only accepts a genuine Blob.
          const bytes = await mediaFileService.readBytes(media.localPath as string);
          form.append(
            'file',
            new Blob([bytes as BlobPart], { type: media.mimeType }),
            media.fileName,
          );
        } else {
          // React Native accepts this "file" format in FormData; it is how it exposes
          // a local file for multipart without loading everything into memory.
          form.append('file', {
            uri: media.localPath as string,
            name: media.fileName,
            type: media.mimeType,
          } as unknown as Blob);
        }
        form.append('mimeType', media.mimeType);

        await client.post(`/media/${storyId}/blobs/${media.hash}`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        await this.galleryService.setLocalFileState(media.id, { uploadState: 'uploaded' });
        summary.uploaded += 1;
      } catch (error) {
        if (isOfflineError(error)) {
          throw error;
        }
        console.log(`MediaSyncService: failed to upload media ${media.id} (${media.hash}).`, error);
        await this.galleryService.setLocalFileState(media.id, { uploadState: 'failed' });
        summary.failed += 1;
      }
    }
  }

  private async downloadMissing(
    client: KeresAxiosInstance,
    server: ServerSelect,
    storyId: string,
    summary: MediaSyncSummary,
  ): Promise<void> {
    const pending = await this.galleryService.getPendingDownloads(storyId);
    if (pending.length === 0) {
      return;
    }

    for (const media of pending.slice(0, MAX_TRANSFERS_PER_CYCLE)) {
      // It may already be here from another medium with the same content, or from a download that
      // finished and never got marked.
      const existingPath = mediaFileService.localPathFor(storyId, media.hash, media.mimeType);
      if (mediaFileService.exists(existingPath)) {
        await this.galleryService.setLocalFileState(media.id, {
          localPath: existingPath,
          downloadState: 'downloaded',
          thumbnailPath: await this.ensureThumbnail(storyId, media, existingPath),
        });
        summary.downloaded += 1;
        continue;
      }

      try {
        const baseUrl = client.defaults.baseURL?.replace(/\/+$/, '');
        if (!baseUrl) {
          return;
        }

        let downloadedUri: string;
        if (Platform.OS === 'web') {
          // There is no `File.downloadFileAsync` on the web (native only) - it goes through axios and writes to
          // OPFS via mediaFileService. A whole video passes through the JS memory here, but
          // there is no streaming-to-disk alternative available in the browser.
          const response = await client.get(`/media/${storyId}/blobs/${media.hash}`, {
            headers: this.authHeaders(server),
            responseType: 'arraybuffer',
          });
          downloadedUri = await mediaFileService.writeDownloaded(
            storyId,
            media.hash,
            media.mimeType,
            new Uint8Array(response.data),
          );
        } else {
          // A direct download to disk instead of going through axios: bringing a video into the
          // JS memory as base64 blows the heap on modest devices.
          const destination = mediaFileService.destinationFor(storyId, media.hash, media.mimeType);
          const downloaded = await File.downloadFileAsync(
            `${baseUrl}/media/${storyId}/blobs/${media.hash}`,
            destination,
            { headers: this.authHeaders(server), idempotent: true },
          );
          downloadedUri = downloaded.uri;
        }

        await this.galleryService.setLocalFileState(media.id, {
          localPath: downloadedUri,
          downloadState: 'downloaded',
          thumbnailPath: await this.ensureThumbnail(storyId, media, downloadedUri),
        });
        summary.downloaded += 1;
      } catch (error) {
        console.log(
          `MediaSyncService: failed to download media ${media.id} (${media.hash}).`,
          error,
        );
        await this.galleryService.setLocalFileState(media.id, { downloadState: 'failed' });
        summary.failed += 1;
      }
    }
  }

  /**
   * Generates the thumbnail of a video that has just arrived through synchronization.
   *
   * It only applies to `mediaType: 'video'`, and only when one does not exist yet - the same
   * content downloaded again (another linked entity, a retry) reuses the file already
   * extracted instead of generating it again.
   */
  private async ensureThumbnail(
    storyId: string,
    media: GallerySelect,
    videoUri: string,
  ): Promise<string | null | undefined> {
    if (media.mediaType !== 'video') {
      return undefined;
    }
    const expectedPath = mediaFileService.thumbnailPathFor(storyId, media.hash);
    if (mediaFileService.exists(media.thumbnailPath) || mediaFileService.exists(expectedPath)) {
      return media.thumbnailPath ?? expectedPath;
    }
    return (await mediaFileService.generateVideoThumbnail(storyId, media.hash, videoUri)) ?? null;
  }

  private async fetchBlobStatus(
    client: KeresAxiosInstance,
    storyId: string,
    hashes: string[],
  ): Promise<MediaBlobStatusResponseType> {
    if (hashes.length === 0) {
      return { present: [], missing: [] };
    }
    // The route accepts at most 500 hashes per call.
    const unique = Array.from(new Set(hashes)).slice(0, 500);
    const response = await client.post<MediaBlobStatusResponseType>(
      `/media/${storyId}/blobs/status`,
      { hashes: unique },
    );
    return response.data;
  }

  /**
   * The download does not go through Axios, so the `Authorization` the interceptor would put in
   * has to be assembled by hand - from the same token cache, so that a refresh
   * done by any other instance already counts here.
   */
  private authHeaders(server: ServerSelect): Record<string, string> {
    const token = getServerAccessToken(server.id);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}

/** Creates the service already tied to the current story's database. */
export function createMediaSyncService(db: AppDrizzleClient): MediaSyncService {
  return new MediaSyncService(db);
}
