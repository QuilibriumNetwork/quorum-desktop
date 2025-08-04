import { useCallback } from 'react';

export function useKeyboardNavigation({
  showSuggestions,
  suggestions,
  selectedSuggestionIndex,
  setSelectedSuggestionIndex,
  onSuggestionSelect,
  onHideSuggestions,
}: {
  showSuggestions: boolean;
  suggestions: string[];
  selectedSuggestionIndex: number;
  setSelectedSuggestionIndex: (
    index: number | ((prev: number) => number)
  ) => void;
  onSuggestionSelect?: (suggestion: string) => void;
  onHideSuggestions: () => void;
}) {
  // Handle keyboard navigation through suggestions
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showSuggestions || suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedSuggestionIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedSuggestionIndex((prev) =>
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          break;
        case 'Enter':
          if (selectedSuggestionIndex >= 0) {
            e.preventDefault();
            const suggestion = suggestions[selectedSuggestionIndex];
            onSuggestionSelect?.(suggestion);
            onHideSuggestions();
            setSelectedSuggestionIndex(-1);
          }
          break;
        case 'Tab':
          if (selectedSuggestionIndex >= 0) {
            e.preventDefault();
            const suggestion = suggestions[selectedSuggestionIndex];
            onSuggestionSelect?.(suggestion);
            onHideSuggestions();
            setSelectedSuggestionIndex(-1);
          }
          break;
      }
    },
    [
      showSuggestions,
      suggestions,
      selectedSuggestionIndex,
      setSelectedSuggestionIndex,
      onSuggestionSelect,
      onHideSuggestions,
    ]
  );

  // Reset selection when suggestions change
  const resetSelection = useCallback(() => {
    setSelectedSuggestionIndex(-1);
  }, [setSelectedSuggestionIndex]);

  return {
    handleKeyDown,
    resetSelection,
  };
}
