import { useCallback, useMemo, useState } from 'react';
import { useDrizzle } from '../db';
import { createSuggestionService } from '../services/storymanagement/SuggestionService';

/** Catalog of saved + in-story values for a suggestion type. Reload is owned by the caller. */
export function useSuggestions(storyId: string | undefined, type: string | undefined) {
  const db = useDrizzle();
  const [suggestions, setSuggestions] = useState<[string, number][]>([]);
  const [loading, setLoading] = useState(false);
  const service = useMemo(() => (db ? createSuggestionService(db) : null), [db]);

  const reload = useCallback(async () => {
    if (!service || !type || !storyId) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      setSuggestions(await service.getSuggestions(type, storyId));
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [service, storyId, type]);

  return { suggestions, loading, reload };
}
