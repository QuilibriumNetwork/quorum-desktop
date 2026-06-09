import { useEffect, useRef } from 'react';

/**
 * Keep the active pill in view inside a horizontally-scrollable pill nav.
 *
 * When the selected category changes by user action, the active pill scrolls
 * itself to the center of the container. Without this, tapping a pill near
 * the edge of the viewport would mark it active without actually moving the
 * scroll position — the user loses sight of what they just selected.
 *
 * The first render is intentionally skipped so the natural scroll-at-zero
 * position (with the container's left padding visible) is preserved on mount.
 *
 * Mark the active pill with `data-active="true"` for the lookup to find it.
 */
export function useScrollActivePillIntoView(activeId: string) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const container = containerRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLElement>('[data-active="true"]');
    if (!active) return;
    active.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [activeId]);

  return containerRef;
}
