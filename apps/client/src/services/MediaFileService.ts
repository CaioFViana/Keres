import type { MediaType } from '@keres/shared';
import {
  DOCUMENT_PICKER_MIME_FILTERS,
  base64ToBytes,
  extensionForMimeType,
  MEDIA_PICKER_MIME_FILTERS,
  MEDIA_SNIFF_HEADER_BYTES,
  isSupportedMediaMimeType,
  mediaTypeForMimeType,
  sniffMediaMimeType,
} from '@keres/shared';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { createVideoPlayer, type VideoPlayer } from 'expo-video';
import { Platform } from 'react-native';
import { decodeFileUriOnce } from '../utils/fileUri';
import * as webMediaStore from './webMediaStore';
import { captureVideoThumbnail } from './webVideoThumbnail';

const isWeb = Platform.OS === 'web';

/** The on-disk path (without the `desktop-media:` prefix) where this medium lives, in webMediaStore's convention. */
function webMediaRelativePath(storyId: string, hash: string, mimeType: string): string {
  return `media/${storyId}/${hash}.${extensionForMimeType(mimeType)}`;
}

function webThumbnailRelativePath(storyId: string, hash: string): string {
  return `media/${storyId}/${hash}_thumb.jpg`;
}

/**
 * Media files on the device.
 *
 * The files live in `<documents>/media/<storyId>/<hash>.<ext>`. The name comes from the content
 * and not from the original name for two reasons: two identical files take up a single space, and
 * the same address holds here and on the server, which does away with keeping any mapping
 * between the local path and the remote one.
 *
 * `documents` and not `cache`: the system may empty the cache at any moment, and media
 * not yet synchronized would have no way of being recovered.
 */

/** A medium chosen by the person, already copied into the application's storage. */
export interface ImportedMedia {
  mediaType: MediaType;
  mimeType: string;
  fileName: string;
  hash: string;
  sizeBytes: number;
  localPath: string;
  /** Video only; see `mediaFileService.thumbnailPathFor`. */
  thumbnailPath?: string;
}

export class UnsupportedMediaError extends Error {
  constructor(
    public readonly mimeType: string | undefined,
    public readonly fileName: string,
  ) {
    super(`Unsupported media type "${mimeType ?? 'unknown'}" for file "${fileName}".`);
    this.name = 'UnsupportedMediaError';
  }
}

function storyMediaDirectory(storyId: string): Directory {
  // Keep the spelling `Paths.document` arrives with: inside Expo Go it is percent-encoded
  // and the permission scope only accepts that form, so decoding here breaks creation with
  // a missing-WRITE-permission rejection. See `decodeFileUriOnce`.
  return new Directory(Paths.document, 'media', storyId);
}

function ensureDirectory(directory: Directory): Directory {
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
  return directory;
}

/**
 * Not every picker returns the mime type (some only give the file name), so the extension
 * serves as a second attempt before giving up on the file.
 */
function resolveMimeType(asset: DocumentPicker.DocumentPickerAsset): string | undefined {
  if (asset.mimeType && isSupportedMediaMimeType(asset.mimeType)) {
    return asset.mimeType.toLowerCase();
  }

  const extension = asset.name?.split('.').pop()?.toLowerCase();
  if (!extension) {
    return undefined;
  }

  const byExtension: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    heic: 'image/heic',
    heif: 'image/heif',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    m4v: 'video/x-m4v',
    mkv: 'video/x-matroska',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    '3gp': 'video/3gpp',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    odt: 'application/vnd.oasis.opendocument.text',
    rtf: 'application/rtf',
    txt: 'text/plain',
    md: 'text/markdown',
    csv: 'text/csv',
    html: 'text/html',
    htm: 'text/html',
    epub: 'application/epub+zip',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    json: 'application/json',
  };

  return byExtension[extension];
}

/**
 * Identifies the file from its first bytes when the picker and the file name say nothing
 * usable.
 *
 * Only the header is read - the whole file is never loaded for this. An unreadable file yields
 * nothing and the caller reports it as unsupported, exactly as if no sniffing existed.
 */
async function sniffAssetMimeType(
  asset: DocumentPicker.DocumentPickerAsset,
): Promise<string | undefined> {
  try {
    const header = isWeb
      ? asset.file
        ? await asset.file.slice(0, MEDIA_SNIFF_HEADER_BYTES).arrayBuffer()
        : undefined
      : await nativeHeaderBytes(asset.uri);
    if (!header) {
      return undefined;
    }
    const sniffed = sniffMediaMimeType(new Uint8Array(header));
    return sniffed && isSupportedMediaMimeType(sniffed) ? sniffed : undefined;
  } catch {
    return undefined;
  }
}

/** Reads a file's first bytes natively, retrying through the legacy module on failure. */
async function nativeHeaderBytes(uri: string): Promise<ArrayBuffer | undefined> {
  try {
    return await new File(uri).slice(0, MEDIA_SNIFF_HEADER_BYTES).arrayBuffer();
  } catch {
    // Same retry as the hash fallback in `importAsset`: the provider URI can defeat either
    // module, so the header comes from the legacy one when the new API cannot read it.
  }
  try {
    const base64 = await LegacyFileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
      position: 0,
      length: MEDIA_SNIFF_HEADER_BYTES,
    });
    return base64ToBytes(base64).buffer as ArrayBuffer;
  } catch {
    return undefined;
  }
}

/** Hashes through the legacy module when the new API cannot read the picked URI. */
async function legacyMd5(uri: string): Promise<string | undefined> {
  try {
    const info = await LegacyFileSystem.getInfoAsync(uri, { md5: true });
    return info.exists && info.md5 ? info.md5 : undefined;
  } catch {
    return undefined;
  }
}

/** The second of the video the grid thumbnail is taken from. */
const VIDEO_THUMBNAIL_TIME_SECONDS = 1;
/** Grid cells are small; anything bigger wastes disk and decode time. */
const VIDEO_THUMBNAIL_MAX_WIDTH = 480;
/** JPEG quality of the persisted thumbnail. */
const VIDEO_THUMBNAIL_JPEG_QUALITY = 0.6;

/**
 * Extracts a frame from the video and writes it beside the medium, with the same hash address.
 *
 * Generated once and persisted (instead of recomputed on every display) because extracting a
 * frame is expensive enough to stall the scrolling if it happened per grid cell on every
 * render. `expo-video` only hands back a reference to a native image, not a file, so the frame
 * is rendered to the cache through `expo-image-manipulator` before it is persisted.
 *
 * The player is created and released inside this function because extraction happens in services
 * (import, sync), outside any component that could own a `useVideoPlayer` hook.
 *
 * A failure here does not stop the medium existing - a video with no thumbnail still plays, it just
 * shows the generic icon in the list.
 */
/**
 * The web counterpart of the native extraction below: the stored bytes are resolved to a
 * `blob:` URL, a frame is captured from it, and the frame is written back to the store under
 * the thumbnail address. `writeBytes` overwrites, so regenerating needs no prior delete.
 */
async function generateWebVideoThumbnail(
  storyId: string,
  hash: string,
  videoUri: string,
): Promise<string | undefined> {
  try {
    const blobUrl = await webMediaStore.resolveBlobUri(videoUri);
    const frame = await captureVideoThumbnail(blobUrl);
    if (!frame) {
      return undefined;
    }
    const thumbnailRelativePath = webThumbnailRelativePath(storyId, hash);
    await webMediaStore.writeBytes(thumbnailRelativePath, frame);
    return webMediaStore.DESKTOP_MEDIA_URI_PREFIX + thumbnailRelativePath;
  } catch (error) {
    console.warn('Could not generate video thumbnail:', error);
    return undefined;
  }
}

async function generateVideoThumbnail(
  storyId: string,
  hash: string,
  videoUri: string,
): Promise<string | undefined> {
  // `expo-video` throws `not supported on Web yet`, so frame extraction on desktop goes through
  // a `<video>` element instead (see `generateWebVideoThumbnail`).
  if (isWeb) {
    return generateWebVideoThumbnail(storyId, hash, videoUri);
  }
  let player: VideoPlayer | undefined;
  try {
    player = createVideoPlayer(decodeFileUriOnce(videoUri));
    const [first] = await player.generateThumbnailsAsync(VIDEO_THUMBNAIL_TIME_SECONDS, {
      maxWidth: VIDEO_THUMBNAIL_MAX_WIDTH,
    });
    // iOS answers with an empty list when the player has nothing loaded yet instead of throwing.
    if (!first) {
      return undefined;
    }
    const rendered = await ImageManipulator.manipulate(first).renderAsync();
    const saved = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: VIDEO_THUMBNAIL_JPEG_QUALITY,
    });
    const directory = ensureDirectory(storyMediaDirectory(storyId));
    const destination = new File(directory, `${hash}_thumb.jpg`);
    if (destination.exists) {
      destination.delete();
    }
    await new File(saved.uri).copy(destination);
    return destination.uri;
  } catch (error) {
    console.warn('Could not generate video thumbnail:', error);
    return undefined;
  } finally {
    player?.release();
  }
}

export const mediaFileService = {
  /** The path where this medium's file lives (or would live) on this device. */
  localPathFor(storyId: string, hash: string, mimeType: string): string {
    if (isWeb) {
      return webMediaStore.DESKTOP_MEDIA_URI_PREFIX + webMediaRelativePath(storyId, hash, mimeType);
    }
    return new File(storyMediaDirectory(storyId), `${hash}.${extensionForMimeType(mimeType)}`).uri;
  },

  /** The path where this video's thumbnail would live on this device. */
  thumbnailPathFor(storyId: string, hash: string): string {
    if (isWeb) {
      return webMediaStore.DESKTOP_MEDIA_URI_PREFIX + webThumbnailRelativePath(storyId, hash);
    }
    return new File(storyMediaDirectory(storyId), `${hash}_thumb.jpg`).uri;
  },

  /**
   * Generates (or regenerates) the thumbnail of a video already present on the device.
   *
   * Used both when importing and after a download from the server - in both
   * cases the video file is already local, only the extracted frame is missing.
   */
  async generateVideoThumbnail(
    storyId: string,
    hash: string,
    videoUri: string,
  ): Promise<string | undefined> {
    return generateVideoThumbnail(storyId, hash, videoUri);
  },

  exists(localPath: string | null | undefined): boolean {
    if (!localPath) {
      return false;
    }
    if (isWeb) {
      return (
        localPath.startsWith(webMediaStore.DESKTOP_MEDIA_URI_PREFIX) &&
        webMediaStore.existsSync(localPath.slice(webMediaStore.DESKTOP_MEDIA_URI_PREFIX.length))
      );
    }
    try {
      return new File(localPath).exists;
    } catch {
      // A path written by an earlier installation may not even be valid today; treating it
      // as absent makes the download happen, which is the correct recovery.
      return false;
    }
  },

  /**
   * Abre o seletor do sistema restrito aos formatos suportados.
   *
   * `copyToCacheDirectory` stays false on purpose: the staged copy lands in the host app's
   * global cache directory, outside the experience sandbox, and inside Expo Go both
   * file-system modules refuse to read it back ("isn't readable") - every mobile import
   * failed on the hash, then on the copy. With the flag off the picker hands over the
   * provider's `content://` URI instead, which both modules let through by design, and the
   * import copies the bytes into the story folder immediately, so the transient provider
   * grant is enough. (On iOS the picker still hands over an app-container file URL either way.)
   *
   * Devolve `null` se a pessoa cancelar.
   */
  async pick(): Promise<DocumentPicker.DocumentPickerAsset[] | null> {
    const result = await DocumentPicker.getDocumentAsync({
      type: [...MEDIA_PICKER_MIME_FILTERS],
      copyToCacheDirectory: false,
      multiple: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }
    return result.assets;
  },

  async pickDocuments(): Promise<DocumentPicker.DocumentPickerAsset[] | null> {
    const result = await DocumentPicker.getDocumentAsync({
      type: [...DOCUMENT_PICKER_MIME_FILTERS],
      // Off for the same sandbox reason as `pick()` (see above): the staged copy is unreadable.
      copyToCacheDirectory: false,
      multiple: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }
    return result.assets;
  },

  /**
   * Copies the chosen file into the application's storage and computes the hash.
   *
   * The hash is `expo-file-system`'s native MD5 - it is the only digest it computes, and
   * doing SHA-256 in JS over a video would freeze the interface. It serves as an address and for
   * change detection; the server recomputes the hash of the bytes it receives, so this is not
   * a security guarantee that depends on the client.
   */
  async importAsset(
    storyId: string,
    asset: DocumentPicker.DocumentPickerAsset,
  ): Promise<ImportedMedia> {
    let mimeType = resolveMimeType(asset);
    if (!mimeType) {
      // The picker does not always report a mime type (Android answers null for providers it
      // does not recognize) and names can arrive without an extension - the content itself is
      // the last resort before giving up on the file.
      mimeType = await sniffAssetMimeType(asset);
    }
    const mediaType = mediaTypeForMimeType(mimeType);

    if (!mimeType || !mediaType) {
      throw new UnsupportedMediaError(asset.mimeType, asset.name || 'unknown');
    }

    if (isWeb) {
      // The web picker (expo-document-picker) hands over the chosen Blob itself in
      // `asset.file` - there is no native file system path to copy from.
      if (!asset.file) {
        throw new Error(`No file data available for "${asset.name}".`);
      }
      const bytes = new Uint8Array(await asset.file.arrayBuffer());
      const hash = webMediaStore.md5Hex(bytes);
      const relativePath = webMediaRelativePath(storyId, hash, mimeType);

      // If it already exists, the bytes are the same by definition of the addressing: rewriting would only
      // waste time and I/O.
      if (!webMediaStore.existsSync(relativePath)) {
        await webMediaStore.writeBytes(relativePath, bytes);
      }

      const localPath = webMediaStore.DESKTOP_MEDIA_URI_PREFIX + relativePath;
      const thumbnailPath =
        mediaType === 'video' ? await generateVideoThumbnail(storyId, hash, localPath) : undefined;

      return {
        mediaType,
        mimeType,
        fileName: asset.name || `${hash}.${extensionForMimeType(mimeType)}`,
        hash,
        sizeBytes: asset.size ?? bytes.byteLength,
        localPath,
        thumbnailPath,
      };
    }

    const source = new File(asset.uri);
    // The picked URI belongs to the provider (`content://` on Android, an app-container file
    // on iOS), not to the story folder - either file-system module can fail reading it
    // (a lost grant, a dead provider, a cloud timeout), so the hash and the copy each retry
    // through the other module before the import gives up. Files the app owns (the story
    // folder) never need the retry.
    let hash: string | null | undefined = source.md5;
    let copyWithLegacy = false;
    if (!hash) {
      copyWithLegacy = true;
      hash = await legacyMd5(asset.uri);
    }
    if (!hash) {
      throw new Error(`Could not compute a content hash for "${asset.name}".`);
    }

    const directory = ensureDirectory(storyMediaDirectory(storyId));
    const destination = new File(directory, `${hash}.${extensionForMimeType(mimeType)}`);

    // If it already exists, the bytes are the same by definition of the addressing: re-copying would only
    // waste time and I/O.
    if (!destination.exists) {
      if (copyWithLegacy) {
        await LegacyFileSystem.copyAsync({ from: asset.uri, to: destination.uri });
      } else {
        try {
          await source.copy(destination);
        } catch {
          await LegacyFileSystem.copyAsync({ from: asset.uri, to: destination.uri });
        }
      }
    }

    const thumbnailPath =
      mediaType === 'video'
        ? await generateVideoThumbnail(storyId, hash, destination.uri)
        : undefined;

    return {
      mediaType,
      mimeType,
      fileName: asset.name || destination.name,
      hash,
      sizeBytes: asset.size ?? destination.size ?? 0,
      localPath: destination.uri,
      thumbnailPath,
    };
  },

  /** Writes bytes coming from the server to the local address corresponding to the hash. */
  async writeDownloaded(
    storyId: string,
    hash: string,
    mimeType: string,
    bytes: Uint8Array,
  ): Promise<string> {
    if (isWeb) {
      const relativePath = webMediaRelativePath(storyId, hash, mimeType);
      await webMediaStore.writeBytes(relativePath, bytes);
      return webMediaStore.DESKTOP_MEDIA_URI_PREFIX + relativePath;
    }

    const directory = ensureDirectory(storyMediaDirectory(storyId));
    const destination = new File(directory, `${hash}.${extensionForMimeType(mimeType)}`);

    if (destination.exists) {
      destination.delete();
    }
    destination.create();
    destination.write(bytes);

    return destination.uri;
  },

  /**
   * The MD5 of a file already on the device, or null when it cannot be read. Used to verify a
   * download before trusting it: on Android a failed download leaves a truncated file behind, and
   * without this check the next cycle would adopt it as complete.
   */
  async md5OfLocalFile(localPath: string): Promise<string | null> {
    if (isWeb) {
      try {
        if (!localPath.startsWith(webMediaStore.DESKTOP_MEDIA_URI_PREFIX)) {
          return null;
        }
        const bytes = await webMediaStore.readBytes(
          localPath.slice(webMediaStore.DESKTOP_MEDIA_URI_PREFIX.length),
        );
        return webMediaStore.md5Hex(bytes);
      } catch {
        return null;
      }
    }
    try {
      return new File(localPath).md5 ?? null;
    } catch {
      return null;
    }
  },

  /** Reads back the bytes of an already local file (used when uploading to the server). */
  async readBytes(localPath: string): Promise<Uint8Array> {
    if (isWeb) {
      if (!localPath.startsWith(webMediaStore.DESKTOP_MEDIA_URI_PREFIX)) {
        throw new Error(`Not a web media path: "${localPath}".`);
      }
      return webMediaStore.readBytes(
        localPath.slice(webMediaStore.DESKTOP_MEDIA_URI_PREFIX.length),
      );
    }
    return new File(localPath).bytes();
  },

  /** The destination to pass to a direct download (`File.downloadFileAsync`) - native only, see MediaSyncService. */
  destinationFor(storyId: string, hash: string, mimeType: string): File {
    const directory = ensureDirectory(storyMediaDirectory(storyId));
    return new File(directory, `${hash}.${extensionForMimeType(mimeType)}`);
  },

  deleteLocal(localPath: string | null | undefined): void {
    if (!localPath) {
      return;
    }
    if (isWeb) {
      if (localPath.startsWith(webMediaStore.DESKTOP_MEDIA_URI_PREFIX)) {
        webMediaStore
          .deleteFile(localPath.slice(webMediaStore.DESKTOP_MEDIA_URI_PREFIX.length))
          .catch((error) => console.warn('Could not delete local media file:', localPath, error));
      }
      return;
    }
    try {
      const file = new File(localPath);
      if (file.exists) {
        file.delete();
      }
    } catch (error) {
      // Failing to delete a local file must not bring down the deletion of the medium itself: the
      // record is the source of truth, the orphaned file is wasted space, not a bug.
      console.warn('Could not delete local media file:', localPath, error);
    }
  },

  /** Removes all of a story's media files (used when deleting the story). */
  deleteStoryMedia(storyId: string): void {
    if (isWeb) {
      webMediaStore
        .deleteDirectory(`media/${storyId}`)
        .catch((error) =>
          console.warn('Could not delete media directory for story:', storyId, error),
        );
      return;
    }
    try {
      const directory = storyMediaDirectory(storyId);
      if (directory.exists) {
        directory.delete();
      }
    } catch (error) {
      console.warn('Could not delete media directory for story:', storyId, error);
    }
  },

  /** Removes the complete application-owned media tree during a full app reset. */
  async deleteAllMedia(): Promise<void> {
    try {
      if (isWeb) {
        // Plain browser builds do not have the Electron filesystem bridge and therefore
        // cannot have files in this store to remove.
        if (typeof window !== 'undefined' && window.keresMedia) {
          await webMediaStore.deleteDirectory('media');
        }
        return;
      }

      // Expo Go can reject Directory.delete() for a non-empty application directory.
      // The legacy implementation explicitly removes directory contents recursively and
      // is idempotent when the directory has never been created.
      const directory = new Directory(Paths.document, 'media');
      await LegacyFileSystem.deleteAsync(directory.uri, { idempotent: true });
    } catch (error) {
      // Orphaned media must not leave the reset half-complete. Its database references
      // are removed below, so a cleanup failure only means reclaiming disk space failed.
      console.warn('Could not remove every local media file during app reset:', error);
    }
  },
};
