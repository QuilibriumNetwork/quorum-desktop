import { useEffect } from 'react';

export interface UseSearchResultsOutsideClickProps {
  containerRef: React.RefObject<HTMLDivElement>;
  onClose?: () => void;
}

/**
 * Handles outside click detection for search results
 * This hook is web-specific and manages DOM event listeners
 * Native version would use different touch/gesture handling
 */
export const useSearchResultsOutsideClick = ({
  containerRef,
  onClose,
}: UseSearchResultsOutsideClickProps): void => {
  // Close on click outside (but not on search bar)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Don't close if clicking on the search results container
      if (containerRef.current && containerRef.current.contains(target)) {
        return;
      }

      // Don't close if clicking on the search bar or its children
      const searchBar = document.querySelector('.search-bar');
      if (searchBar && searchBar.contains(target)) {
        return;
      }

      // Close if clicking anywhere else
      onClose?.();
    };

    // Use a slight delay to avoid conflicts with search bar focus
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [containerRef, onClose]);
};
