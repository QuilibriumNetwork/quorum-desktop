import { useCallback } from 'react';

export interface UseSearchResultsKeyboardProps {
  onClose: () => void;
}

export interface UseSearchResultsKeyboardReturn {
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

/**
 * Handles keyboard navigation for search results
 * This hook is platform-agnostic and manages keyboard interactions
 */
export const useSearchResultsKeyboard = ({
  onClose,
}: UseSearchResultsKeyboardProps): UseSearchResultsKeyboardReturn => {
  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  return {
    handleKeyDown,
  };
};
