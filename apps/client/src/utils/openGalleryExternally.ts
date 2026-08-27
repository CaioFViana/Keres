import { Linking } from 'react-native';
import type { GallerySelect } from '../db/schemas/galleries';
import {
  DESKTOP_MEDIA_URI_PREFIX,
  openInOs,
  resolveBlobUri,
} from '../services/webMediaStore';

/**
 * Opens a gallery link or document outside Keres.
 *
 * Links go to the system browser. Documents go to the OS handler for that file. Image/video/audio
 * stay inside the in-app viewer — this is not their path.
 */
export async function openGalleryExternally(media: GallerySelect) {
  if (media.mediaType === 'link') {
    if (!media.sourceUrl) return false;
    await Linking.openURL(media.sourceUrl);
    return true;
  }
  if (media.mediaType !== 'document') {
    return false;
  }

  const storedPath = media.localPath;
  if (!storedPath) return false;

  if (storedPath.startsWith(DESKTOP_MEDIA_URI_PREFIX)) {
    const relativePath = storedPath.slice(DESKTOP_MEDIA_URI_PREFIX.length);
    if (await openInOs(relativePath)) {
      return true;
    }
    // Hosted browser: OPFS has no OS path. A new tab is the closest "outside".
    if (typeof window !== 'undefined' && typeof window.open === 'function') {
      window.open(await resolveBlobUri(storedPath), '_blank', 'noopener,noreferrer');
      return true;
    }
    return false;
  }

  await Linking.openURL(storedPath);
  return true;
}