import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { DESKTOP_MEDIA_URI_PREFIX, resolveBlobUri } from '../services/webMediaStore';

/**
 * Resolves several media paths into renderable URIs at once (the board resolves one at a time;
 * a map has many image bases). Same rules as `useResolvedMediaUri`: native paths pass through,
 * web `desktop-media:` paths become `blob:` URLs asynchronously.
 */
export function useResolvedMediaUris(
  paths: (string | null | undefined)[],
): Record<string, string | null> {
  const [resolved, setResolved] = useState<Record<string, string | null>>({});
  const key = paths.join('|');
  const uniquePaths = [...new Set(paths.filter((path): path is string => Boolean(path)))];

  const [prevKey, setPrevKey] = useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    if (uniquePaths.length === 0) {
      setResolved({});
    }
  }

  useEffect(() => {
    if (uniquePaths.length === 0) {
      return;
    }
    let cancelled = false;
    (async () => {
      const next: Record<string, string | null> = {};
      await Promise.all(
        uniquePaths.map(async (path) => {
          if (Platform.OS !== 'web' || !path.startsWith(DESKTOP_MEDIA_URI_PREFIX)) {
            next[path] = path;
            return;
          }
          try {
            next[path] = await resolveBlobUri(path);
          } catch (error) {
            console.warn('useResolvedMediaUris: failed to resolve', path, error);
            next[path] = null;
          }
        }),
      );
      if (!cancelled) setResolved(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return resolved;
}
