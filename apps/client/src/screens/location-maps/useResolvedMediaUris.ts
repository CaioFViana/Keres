import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import {
  DESKTOP_MEDIA_URI_PREFIX,
  resolveBlobUri,
} from '@/src/services/platform-web/webMediaStore';
import { logger } from '@/src/utils/logging/logger';
import { fireAndLog } from '@/src/utils/logging/fireAndLog';

const uniqueOf = (paths: (string | null | undefined)[]) => [
  ...new Set(paths.filter((path): path is string => Boolean(path))),
];

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
  // The unique paths are rebuilt every render; they are kept as state that follows `key`, so the
  // effect below runs when the paths change and not on every render.
  const [uniquePaths, setUniquePaths] = useState(() => uniqueOf(paths));

  const [prevKey, setPrevKey] = useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    const next = uniqueOf(paths);
    setUniquePaths(next);
    if (next.length === 0) {
      setResolved({});
    }
  }

  useEffect(() => {
    if (uniquePaths.length === 0) {
      return;
    }
    let cancelled = false;
    fireAndLog(
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
              logger.warn('useResolvedMediaUris: failed to resolve', path, error);
              next[path] = null;
            }
          }),
        );
        if (!cancelled) setResolved(next);
      })(),
      'useResolvedMediaUris',
    );
    return () => {
      cancelled = true;
    };
  }, [uniquePaths]);

  return resolved;
}
