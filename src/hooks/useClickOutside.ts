import { useEffect, RefObject } from 'react';

/**
 * Hook to detect clicks outside a referenced element
 * @param ref - React ref to the element to monitor
 * @param onClickOutside - Callback when click occurs outside the element
 * @param enabled - Whether the hook is active (default: true)
 */
export function useClickOutside(
  ref: RefObject<HTMLElement>,
  onClickOutside: () => void,
  enabled: boolean = true
): void {
  useEffect(() => {
    if (!enabled) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClickOutside();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [ref, onClickOutside, enabled]);
}

export default useClickOutside;
