/**
 * useSearch — wraps useSearchStore for declarative search usage.
 *
 * Usage:
 *   const { results, allResults, isSearching, statusMessage, search, isConnected } = useSearch();
 *   useEffect(() => { search('milk'); }, [query]);
 */
import { useCallback } from 'react';
import useSearchStore from '../store/useSearchStore';

export function useSearch() {
  const {
    products,
    isSearching,
    statusMessage,
    isConnected,
    lastQuery,
    suggestions,
    search: _search,
    getSuggestions: _getSuggestions,
    clearSuggestions,
  } = useSearchStore();

  /**
   * Trigger a new search. Skips if already searching the same query.
   * @param {string} query
   */
  const search = useCallback(
    (query) => {
      if (!query?.trim()) return;
      _search(query);
    },
    [_search],
  );

  /**
   * Request autocomplete suggestions. Debounce in the UI before calling.
   * @param {string} query
   */
  const getSuggestions = useCallback(
    (query) => {
      _getSuggestions(query);
    },
    [_getSuggestions],
  );

  return {
    /** Flat product arrays keyed by source, e.g. { blinkit: [...] } */
    results: products,
    /** Convenience: all products across all sources as a single flat array */
    allResults: Object.values(products).flat(),
    isSearching,
    statusMessage,
    isConnected,
    lastQuery,
    suggestions,
    search,
    getSuggestions,
    clearSuggestions,
  };
}
