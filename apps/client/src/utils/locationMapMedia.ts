import { Image, Platform } from 'react-native';
import { DESKTOP_MEDIA_URI_PREFIX, resolveBlobUri } from '../services/webMediaStore';

/** Resolves a media path into something `Image.getSize` can read (blob URI on web). */
export async function resolveImagePath(localPath: string): Promise<string> {
  if (Platform.OS === 'web' && localPath.startsWith(DESKTOP_MEDIA_URI_PREFIX)) {
    return resolveBlobUri(localPath);
  }
  return localPath;
}

/** Natural pixel size of a media file, so an image base keeps its real aspect ratio. */
export function imageSizeOf(localPath: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    resolveImagePath(localPath)
      .then((uri) => {
        Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
      })
      .catch(reject);
  });
}

/** Base64 of the bytes, chunked so a large image does not blow the call stack. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}