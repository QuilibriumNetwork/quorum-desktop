import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Hook for debounced window resize handling.
 * Prevents excessive callback invocations during window drag resizing.
 *
 * @param callback - Function to call after resize stops
 * @param delay - Debounce delay in ms (default: 150ms)
 *
 * @example
 * ```tsx
 * const updateLayout = useCallback(() => {
 *   // Handle resize
 * }, []);
 *
 * useWindowResize(updateLayout, 200);
 * ```
 */
export function useWindowResize(callback: () => void, delay = 150): void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Memoize the debounced handler
  const debouncedCallback = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(callback, delay);
  }, [callback, delay]);

  useEffect(() => {
    // Call immediately on mount
    callback();

    window.addEventListener('resize', debouncedCallback);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      window.removeEventListener('resize', debouncedCallback);
    };
  }, [callback, debouncedCallback]);
}

/**
 * Hook that returns debounced window dimensions.
 * Updates state only after resize stops.
 *
 * @param delay - Debounce delay in ms (default: 150ms)
 * @returns [width, height] tuple
 *
 * @example
 * ```tsx
 * const [width, height] = useDebouncedWindowSize(200);
 * ```
 */
export function useDebouncedWindowSize(delay = 150): [number, number] {
  const [size, setSize] = useState<[number, number]>([
    typeof window !== 'undefined' ? window.innerWidth : 0,
    typeof window !== 'undefined' ? window.innerHeight : 0,
  ]);

  const updateSize = useCallback(() => {
    setSize([window.innerWidth, window.innerHeight]);
  }, []);

  useWindowResize(updateSize, delay);

  return size;
}
