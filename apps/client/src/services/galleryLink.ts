import { normalizeGalleryLink } from '@keres/shared';
import SparkMD5 from 'spark-md5';
import type { GallerySelect } from '../db/schemas/galleries';
import type { GalleryService } from './storymanagement/GalleryService';

export function hashGalleryLink(url: string): string {
  return SparkMD5.hash(url);
}

export async function createGalleryLink(
  galleryService: GalleryService,
  storyId: string,
  userId: string,
  rawUrl: string,
  title?: string | null,
): Promise<{ gallery: GallerySelect; duplicate: boolean } | null> {
  const url = normalizeGalleryLink(rawUrl);
  if (!url) return null;

  const hash = hashGalleryLink(url);
  const existing = await galleryService.getByHash(storyId, hash);
  if (existing) return { gallery: existing, duplicate: true };

  const host = new URL(url).hostname;
  const gallery = await galleryService.createGallery(userId, {
    storyId,
    mediaType: 'link',
    mimeType: 'text/uri-list',
    fileName: host || url,
    hash,
    sizeBytes: 0,
    sourceUrl: url,
    title: title?.trim() || null,
    localPath: null,
  });
  return { gallery, duplicate: false };
}
