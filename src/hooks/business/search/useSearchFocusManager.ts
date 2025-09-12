import { useRef, useCallback, useEffect } from 'react';

export interface UseSearchFocusManagerProps {
  searchInputRef?: React.RefObject<HTMLInputElement>;
  isResultsVisible: boolean;
}

export interface UseSearchFocusManagerReturn {
  maintainFocus: () => void;
  preventFocusSteal: (callback: () => void) => void;
}

/**
 * Enhanced focus management specifically for search results to prevent focus stealing
 * when async operations (like batch API calls) cause state updates
 */
export const useSearchFocusManager = ({
  searchInputRef,
  isResultsVisible,
}: UseSearchFocusManagerProps): UseSearchFocusManagerReturn => {
  const focusTimeoutRef = useRef<NodeJS.Timeout>();
  const isUserInteracting = useRef(false);
  const focusScheduled = useRef(false);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }
    };
  }, []);

  // Track user interaction to prevent unwanted focus restoration
  useEffect(() => {
    const handleUserInteraction = () => {
      isUserInteracting.current = true;
      setTimeout(() => {
        isUserInteracting.current = false;
      }, 100);
    };

    // Listen for user interaction events
    document.addEventListener('mousedown', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);

    return () => {
      document.removeEventListener('mousedown', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
  }, []);

  // Maintain focus on search input during async operations
  const maintainFocus = useCallback(() => {
    if (focusScheduled.current) return;

    focusScheduled.current = true;

    // Use requestAnimationFrame to ensure DOM updates have completed
    requestAnimationFrame(() => {
      // Check if input should maintain focus
      if (
        isResultsVisible &&
        searchInputRef?.current &&
        !isUserInteracting.current
      ) {
        const activeElement = document.activeElement;

        // Only restore focus if it was lost unexpectedly
        if (activeElement !== searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }

      focusScheduled.current = false;
    });
  }, [isResultsVisible, searchInputRef]);

  // Prevent focus stealing during async operations
  const preventFocusSteal = useCallback(
    (callback: () => void) => {
      // Store current focus before async operation
      const currentFocus = document.activeElement as HTMLElement;
      const shouldRestoreFocus = currentFocus === searchInputRef?.current;

      // Execute the callback
      callback();

      // Schedule focus restoration if needed
      if (shouldRestoreFocus && searchInputRef?.current) {
        // Clear any existing timeout
        if (focusTimeoutRef.current) {
          clearTimeout(focusTimeoutRef.current);
        }

        // Schedule focus restoration after a short delay to allow for DOM updates
        focusTimeoutRef.current = setTimeout(() => {
          if (searchInputRef?.current && !isUserInteracting.current) {
            searchInputRef.current.focus();
          }
        }, 50);
      }
    },
    [searchInputRef]
  );

  return {
    maintainFocus,
    preventFocusSteal,
  };
};
