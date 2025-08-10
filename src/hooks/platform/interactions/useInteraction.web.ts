interface InteractionAdapter {
  setupEventListeners: (
    elementId: string,
    onCopy: () => void,
    touchTrigger: 'click' | 'long-press',
    longPressDuration: number
  ) => () => void;
  isTouch: boolean;
}

// Helper function to detect touch devices
const isTouchDevice = (): boolean => {
  if (typeof window === 'undefined') return false;

  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0
  );
};

export const useInteractionAdapter = (): InteractionAdapter => {
  const setupEventListeners = (
    elementId: string,
    onCopy: () => void,
    touchTrigger: 'click' | 'long-press',
    longPressDuration: number
  ): (() => void) => {
    if (!isTouchDevice()) {
      return () => {}; // No cleanup needed for non-touch
    }

    // Our Tooltip primitive uses ${id}-anchor format for anchor IDs
    const actualAnchorId = `${elementId}-anchor`;
    const anchorElement = document.getElementById(actualAnchorId);
    if (!anchorElement) {
      return () => {}; // No cleanup needed if element not found
    }

    let pressTimer: NodeJS.Timeout | null = null;

    const handleTouchCopy = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      onCopy();
    };

    if (touchTrigger === 'click') {
      anchorElement.addEventListener('touchend', handleTouchCopy, {
        passive: false,
      });
      return () => {
        anchorElement.removeEventListener('touchend', handleTouchCopy);
      };
    }

    if (touchTrigger === 'long-press') {
      const handleTouchStart = (e: TouchEvent) => {
        pressTimer = setTimeout(() => handleTouchCopy(e), longPressDuration);
      };
      const handleTouchEnd = () => {
        if (pressTimer) clearTimeout(pressTimer);
      };

      anchorElement.addEventListener('touchstart', handleTouchStart);
      anchorElement.addEventListener('touchend', handleTouchEnd);
      anchorElement.addEventListener('touchcancel', handleTouchEnd);

      return () => {
        anchorElement.removeEventListener('touchstart', handleTouchStart);
        anchorElement.removeEventListener('touchend', handleTouchEnd);
        anchorElement.removeEventListener('touchcancel', handleTouchEnd);
        if (pressTimer) clearTimeout(pressTimer);
      };
    }

    return () => {}; // Default cleanup
  };

  return {
    setupEventListeners,
    isTouch: isTouchDevice(),
  };
};