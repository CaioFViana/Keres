import { useCallback, useState } from 'react';
import { useSuggestions } from '../../../../hooks/useSuggestions';
import type { SuggestionType } from '../../../../services/storymanagement/SuggestionService';

/**
 * Catalog state of the suggestion inputs: the picker's visibility and search, plus the catalog
 * itself. The catalog is fetched when the picker opens, never on mount, unless the caller asks.
 */
export function useSuggestionCatalog(storyId: string, type: SuggestionType) {
  const { suggestions, loading, reload } = useSuggestions(storyId, type);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const closeSuggestions = useCallback(() => {
    setShowSuggestions(false);
    setSearchQuery('');
  }, []);

  const toggleSuggestions = () => {
    if (showSuggestions) {
      closeSuggestions();
    } else {
      setShowSuggestions(true);
      void reload();
    }
  };

  return {
    suggestions,
    loading,
    reload,
    showSuggestions,
    searchQuery,
    setSearchQuery,
    closeSuggestions,
    toggleSuggestions,
  };
}
