import { useState, useCallback } from 'react';

export interface UseGlobalSearchStateProps {
  minQueryLength?: number;
}

export interface UseGlobalSearchStateReturn {
  showResults: boolean;
  setShowResults: (show: boolean) => void;
  handleQueryChange: (query: string, setQuery: (query: string) => void) => void;
  handleSuggestionSelect: (
    suggestion: string,
    setQuery: (query: string) => void
  ) => void;
  handleClear: (clearSearch: () => void) => void;
  handleCloseResults: () => void;
}

/**
 * Manages the state and handlers for global search functionality
 * This hook is platform-agnostic and handles all search UI state transitions
 */
export const useGlobalSearchState = ({
  minQueryLength = 3,
}: UseGlobalSearchStateProps = {}): UseGlobalSearchStateReturn => {
  const [showResults, setShowResults] = useState(false);

  const handleQueryChange = useCallback(
    (query: string, setQuery: (query: string) => void) => {
      setQuery(query);
      setShowResults(query.trim().length >= minQueryLength);
    },
    [minQueryLength]
  );

  const handleSuggestionSelect = useCallback(
    (suggestion: string, setQuery: (query: string) => void) => {
      setQuery(suggestion);
      setShowResults(true);
    },
    []
  );

  const handleClear = useCallback((clearSearch: () => void) => {
    clearSearch();
    setShowResults(false);
  }, []);

  const handleCloseResults = useCallback(() => {
    setShowResults(false);
  }, []);

  return {
    showResults,
    setShowResults,
    handleQueryChange,
    handleSuggestionSelect,
    handleClear,
    handleCloseResults,
  };
};
