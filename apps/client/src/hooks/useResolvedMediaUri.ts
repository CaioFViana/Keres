import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { DESKTOP_MEDIA_URI_PREFIX, resolveBlobUri } from '../services/webMediaStore';

/**
 * Resolves a media `localPath`/`thumbnailPath` into something `<Image>`/`<video>`/`<audio>` can load.
 *
 * Native: the stored value is already a direct `file://`, returned unchanged. Web: the stored value is
 * a stable path on disk (`desktop-media:media/...` - see MediaFileService.ts), which is not directly
 * loadable; it has to become a `blob:` URL first, which can only happen asynchronously (reading the
 * file through the main process's IPC). That is why the hook starts at `null` (still resolving) until
 * the effect completes.
 */
export function useResolvedMediaUri(path: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setResolved(null);
      return;
    }

    if (Platform.OS !== 'web' || !path.startsWith(DESKTOP_MEDIA_URI_PREFIX)) {
      setResolved(path);
      return;
    }

    let cancelled = false;
    setResolved(null);
    resolveBlobUri(path)
      .then((blobUri) => {
        if (!cancelled) {
          setResolved(blobUri);
        }
      })
      .catch((error) => {
        console.warn('useResolvedMediaUri: failed to resolve', path, error);
        if (!cancelled) {
          setResolved(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  return resolved;
}
