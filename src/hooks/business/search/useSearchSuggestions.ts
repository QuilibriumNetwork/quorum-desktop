import { useState, useCallback, useRef } from 'react';

export function useSearchSuggestions({
  suggestions = [],
  onSuggestionSelect,
}: {
  suggestions?: string[];
  onSuggestionSelect?: (suggestion: string) => void;
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Show/hide suggestions based on query and available suggestions
  const updateSuggestionsVisibility = useCallback(
    (query: string, hasSuggestions: boolean) => {
      setShowSuggestions(query.length > 0 && hasSuggestions);
      if (query.length === 0) {
        setSelectedSuggestionIndex(-1);
      }
    },
    []
  );

  // Handle suggestion selection
  const selectSuggestion = useCallback(
    (suggestion: string) => {
      onSuggestionSelect?.(suggestion);
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    },
    [onSuggestionSelect]
  );

  // Handle suggestion click
  const handleSuggestionClick = useCallback(
    (suggestion: string, focusInput?: () => void) => {
      selectSuggestion(suggestion);
      focusInput?.();
    },
    [selectSuggestion]
  );

  // Clear suggestions
  const clearSuggestions = useCallback(() => {
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
  }, []);

  // Handle focus changes
  const handleFocus = useCallback(
    (query: string) => {
      setShowSuggestions(query.length > 0 && suggestions.length > 0);
    },
    [suggestions.length]
  );

  const handleBlur = useCallback(() => {
    // Delay to allow suggestion clicks
    setTimeout(() => {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }, 150);
  }, []);

  return {
    // State
    showSuggestions,
    selectedSuggestionIndex,
    suggestionsRef,

    // Actions
    updateSuggestionsVisibility,
    selectSuggestion,
    handleSuggestionClick,
    clearSuggestions,
    handleFocus,
    handleBlur,
    setSelectedSuggestionIndex,
  };
}
