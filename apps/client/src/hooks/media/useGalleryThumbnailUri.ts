import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { mediaFileService } from '@/src/services/media/MediaFileService';
import { wantsImageThumbnail } from '@/src/services/platform-web/webImageThumbnail';
import { useResolvedMediaUri } from './useResolvedMediaUri';

/** What it takes to pick the picture a list shows for one medium. */
export interface GalleryThumbnailSource {
  storyId: string;
  hash: string;
  mediaType: string;
  mimeType: string;
  sizeBytes: number | null;
  localPath: string | null;
  thumbnailPath: string | null;
}

/**
 * The URI a list (a grid cell, a picker, a page strip) shows for a medium.
 *
 * A video shows its extracted frame. A big picture on web shows its thumbnail, made once and kept beside the picture,
 * and nothing while that is being made: the cell holds its type's icon for a moment rather than decoding the full
 * picture, which is exactly what a thumbnail is there to avoid. Everything else - small pictures, every picture on
 * native, where the image component already decodes to the size it is shown at - shows the file itself, as before.
 */
export function useGalleryThumbnailUri(
  media: GalleryThumbnailSource | null | undefined,
): string | null {
  const isWeb = Platform.OS === 'web';
  const mediaType = media?.mediaType;
  const wantsThumbnail =
    isWeb &&
    mediaType === 'image' &&
    !!media?.localPath &&
    wantsImageThumbnail(media.mimeType, media.sizeBytes ?? 0);
  const thumbnailPath =
    wantsThumbnail && media ? mediaFileService.thumbnailPathFor(media.storyId, media.hash) : null;

  // The medium the thumbnail was last confirmed for, and the ones that cannot have one (the picture is shown instead).
  const [madeFor, setMadeFor] = useState<string | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const identity = media ? `${media.storyId}/${media.hash}` : null;
  const ready = !!thumbnailPath && (madeFor === identity || mediaFileService.exists(thumbnailPath));
  const failed = failedFor === identity;

  useEffect(() => {
    if (!wantsThumbnail || !media || ready || failed || !media.localPath) {
      return;
    }
    let cancelled = false;
    mediaFileService
      .ensureImageThumbnail(media.storyId, media.hash, media.localPath, media.mimeType)
      .then((made) => {
        if (cancelled) return;
        if (made) setMadeFor(identity);
        else setFailedFor(identity);
      })
      .catch(() => {
        if (!cancelled) setFailedFor(identity);
      });
    return () => {
      cancelled = true;
    };
  }, [wantsThumbnail, media, ready, failed, identity]);

  let target: string | null | undefined;
  if (mediaType === 'video') {
    target = media?.thumbnailPath;
  } else if (wantsThumbnail && !failed) {
    target = ready ? thumbnailPath : null;
  } else {
    target = media?.localPath;
  }
  return useResolvedMediaUri(target);
}
