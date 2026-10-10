import { useCallback, useRef, useState } from 'react';
import { useGraphStoryReload } from './useGraphStoryReload';

interface GraphDataLoader<T> {
  /** The latest data, or null until the first load succeeds. */
  data: T | null;
  /** True only while the first load of a story is running: a refresh keeps the drawing on screen. */
  loading: boolean;
  error: string | null;
}

/**
 * Loads what a graph screen draws and keeps it current (on focus, and when the story changes
 * elsewhere). Only the first load of a story takes the screen over with a loading state; later
 * reloads swap the data in silently, so the canvas stays mounted and the author keeps their pan,
 * zoom and selection when they come back from another screen.
 */
export function useGraphDataLoader<T>({
  storyId,
  load,
  errorMessage,
  logMessage,
}: {
  storyId: string | undefined;
  load: (storyId: string) => Promise<T>;
  /** Shown when the first load fails. */
  errorMessage: string;
  logMessage: string;
}): GraphDataLoader<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** The story whose data is on screen; a different story starts from the loading state again. */
  const loadedStory = useRef<string | undefined>(undefined);

  const reload = useCallback(async () => {
    if (!storyId) return;
    const first = loadedStory.current !== storyId;
    try {
      if (first) {
        setLoading(true);
        setError(null);
      }
      const loaded = await load(storyId);
      loadedStory.current = storyId;
      setData(loaded);
      setError(null);
    } catch (loadError) {
      console.log(logMessage, loadError);
      // A refresh that fails leaves what is on screen alone; only the first load reports it.
      if (first) setError(errorMessage);
    } finally {
      if (first) setLoading(false);
    }
  }, [errorMessage, load, logMessage, storyId]);

  useGraphStoryReload(storyId, reload);

  return { data, loading, error };
}
