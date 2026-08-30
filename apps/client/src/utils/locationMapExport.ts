import type { LocationMapContentType } from '@keres/shared';
import { mediaFileService } from '../services/MediaFileService';
import { bytesToBase64 } from './locationMapMedia';
import { renderLocationMapSvg } from './locationMapSvg';
import type { LocationMapSvgOptions } from './locationMapSvg';

export interface LocationMapExportMedia {
  mediaType: string;
  mimeType: string;
  localPath: string | null;
}

/**
 * Builds the exported SVG of a location map: reads the bytes of the image bases used on the map
 * and embeds them as data URIs, then renders the standalone file. Images that cannot be read are
 * skipped - the exported map keeps a placeholder for them.
 */
export async function buildLocationMapSvg(
  content: LocationMapContentType,
  mediaById: Record<string, LocationMapExportMedia | undefined>,
  options: Omit<LocationMapSvgOptions, 'imageUris'>,
): Promise<string> {
  const imageUris: Record<string, string> = {};
  for (const image of content.images) {
    const media = mediaById[image.galleryId];
    if (!media || media.mediaType !== 'image' || !media.localPath) continue;
    try {
      const bytes = await mediaFileService.readBytes(media.localPath);
      imageUris[image.galleryId] =
        `data:${media.mimeType || 'image/jpeg'};base64,${bytesToBase64(bytes)}`;
    } catch (readError) {
      console.log('LocationMapScreen: failed to read image for export.', readError);
    }
  }
  return renderLocationMapSvg(content, { ...options, imageUris });
}
