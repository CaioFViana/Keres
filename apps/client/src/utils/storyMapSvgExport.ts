import type { BoardContentType } from '@keres/shared';
import type {
  LocationMapConnection,
  LocationMapContains,
} from '@/src/components/features/location-maps/LocationMapCanvas';
import { mediaFileService } from '../services/MediaFileService';
import type { BoardEntitySummary } from './boardEntitySummary';
import type { BoardGalleryMediaById } from './boardLayout';
import { renderBoardSvg, type BoardSvgOptions } from './boardSvg';
import {
  buildLocationMapSvg as buildLocationMapSvgFile,
  type LocationMapExportMedia,
} from './locationMapExport';
import type { LocationMapContentType } from '@keres/shared';
import { bytesToBase64 } from './locationMapMedia';

type SvgColors = {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
};

interface BuildLocationMapSvgOptions {
  title: string;
  subtitle: string;
  colors: SvgColors;
  nodeNames: Record<string, string>;
  connections: LocationMapConnection[];
  contains: LocationMapContains[];
}

interface BuildBoardSvgOptions {
  title: string;
  subtitle: string;
  colors: SvgColors;
  titles: BoardSvgOptions['titles'];
  galleryMediaById: BoardGalleryMediaById;
  summaries: Record<string, BoardEntitySummary | null>;
}

/** Builds a standalone location-map SVG with the map's image bases embedded. */
export function buildStandaloneLocationMapSvg(
  content: LocationMapContentType,
  galleryMediaById: Record<string, LocationMapExportMedia | undefined>,
  options: BuildLocationMapSvgOptions,
): Promise<string> {
  return buildLocationMapSvgFile(content, galleryMediaById, options);
}

/** Builds a standalone board SVG with images from pinned galleries embedded. */
export async function buildStandaloneBoardSvg(
  content: BoardContentType,
  options: BuildBoardSvgOptions,
): Promise<string> {
  const galleryImages: Record<string, string> = {};
  for (const node of content.nodes) {
    if (node.kind !== 'entity' || node.entityType !== 'Gallery') continue;
    const media = options.galleryMediaById[node.entityId];
    if (!media) continue;
    const path = media.mediaType === 'image' ? media.localPath : media.thumbnailPath;
    if (!path) continue;
    try {
      const bytes = await mediaFileService.readBytes(path);
      galleryImages[node.entityId] =
        `data:${media.mimeType || 'image/jpeg'};base64,${bytesToBase64(bytes)}`;
    } catch (readError) {
      console.log('BoardCanvasScreen: failed to read gallery image for export.', readError);
    }
  }

  return renderBoardSvg(content, { ...options, galleryImages });
}
