import { useRef, useEffect, useCallback } from 'react';

export interface UseSearchResultsResponsiveProps {
  results: any[];
  query: string;
}

export interface UseSearchResultsResponsiveReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Handles responsive positioning and sizing for search results
 * This hook contains web-specific DOM manipulation logic
 * Native version would handle differently (no DOM manipulation needed)
 */
export const useSearchResultsResponsive = ({
  results,
  query,
}: UseSearchResultsResponsiveProps): UseSearchResultsResponsiveReturn => {
  const containerRef = useRef<HTMLDivElement>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout>(undefined);

  // Debounced dimension update function
  const updateDimensions = useCallback(() => {
    if (!containerRef.current) return;

    requestAnimationFrame(() => {
      if (!containerRef.current) return;

      const viewportWidth = window.innerWidth;
      const isMobile = viewportWidth <= 1023;
      const navMenuWidth = isMobile ? 74 : 0;

      // Calculate available width accounting for nav menu
      const availableWidth = viewportWidth - navMenuWidth - 40; // 40px for margins
      const maxWidth = Math.min(400, availableWidth);
      const minWidth = 200;
      const responsiveWidth = Math.max(minWidth, maxWidth);

      // Apply responsive width with !important to override any CSS
      containerRef.current.style.setProperty(
        'width',
        `${responsiveWidth}px`,
        'important'
      );
      containerRef.current.style.setProperty(
        'min-width',
        `${minWidth}px`,
        'important'
      );
      containerRef.current.style.setProperty(
        'max-width',
        `${responsiveWidth}px`,
        'important'
      );

      // Check if results would go off the right side of the screen
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.right > viewportWidth) {
        containerRef.current.style.right = '0';
        containerRef.current.style.left = 'auto';
      }
    });
  }, []);

  // Adjust position and width to prevent going off-screen
  useEffect(() => {
    // Clear previous timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Debounce updates during active search to prevent performance issues
    updateTimeoutRef.current = setTimeout(() => {
      updateDimensions();
    }, 100);

    // Add resize listener only once
    window.addEventListener('resize', updateDimensions);

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      window.removeEventListener('resize', updateDimensions);
    };
  }, [results, query, updateDimensions]);

  return {
    containerRef,
  };
};
