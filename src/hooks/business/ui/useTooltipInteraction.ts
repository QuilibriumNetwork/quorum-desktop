import { useState, useEffect, useRef, useCallback } from 'react';
import { isTouchDevice } from './useCopyToClipboard';

interface UseTooltipInteractionOptions {
  touchTrigger?: 'click' | 'long-press';
  longPressDuration?: number;
  hideDelay?: number;
}

interface UseTooltipInteractionReturn {
  showTooltip: boolean;
  hideTooltip: boolean;
  tooltipId: string;
  anchorId: string;
  handleTooltipTrigger: () => void;
  setupTouchHandlers: (element: HTMLElement | null) => void;
}

export const useTooltipInteraction = (
  options: UseTooltipInteractionOptions = {}
): UseTooltipInteractionReturn => {
  const {
    touchTrigger = 'click',
    longPressDuration = 700,
    hideDelay = 3000
  } = options;

  const [showTooltip, setShowTooltip] = useState(true);
  const [hideTooltip, setHideTooltip] = useState(false);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Generate unique IDs for tooltip and anchor
  const tooltipId = useRef(`tooltip-${Math.random().toString(36).slice(2, 10)}`).current;
  const anchorId = useRef(`anchor-${Math.random().toString(36).slice(2, 10)}`).current;

  const handleTooltipTrigger = useCallback(() => {
    setShowTooltip(true);
    setHideTooltip(false);

    // On touch devices, auto-hide after delay
    if (isTouchDevice()) {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
      
      hideTimerRef.current = setTimeout(() => {
        setHideTooltip(true);
        setShowTooltip(false);
      }, hideDelay);
    }
  }, [hideDelay]);

  const setupTouchHandlers = useCallback((element: HTMLElement | null) => {
    if (!element || !isTouchDevice()) return;

    const handleTouchEvent = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      handleTooltipTrigger();
    };

    if (touchTrigger === 'click') {
      element.addEventListener('touchend', handleTouchEvent, { passive: false });
      
      return () => {
        element.removeEventListener('touchend', handleTouchEvent);
      };
    }

    if (touchTrigger === 'long-press') {
      const handleTouchStart = (e: TouchEvent) => {
        pressTimerRef.current = setTimeout(() => {
          handleTouchEvent(e);
        }, longPressDuration);
      };

      const handleTouchEnd = () => {
        if (pressTimerRef.current) {
          clearTimeout(pressTimerRef.current);
          pressTimerRef.current = null;
        }
      };

      element.addEventListener('touchstart', handleTouchStart);
      element.addEventListener('touchend', handleTouchEnd);
      element.addEventListener('touchcancel', handleTouchEnd);

      return () => {
        element.removeEventListener('touchstart', handleTouchStart);
        element.removeEventListener('touchend', handleTouchEnd);
        element.removeEventListener('touchcancel', handleTouchEnd);
      };
    }
  }, [touchTrigger, longPressDuration, handleTooltipTrigger]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pressTimerRef.current) {
        clearTimeout(pressTimerRef.current);
      }
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  return {
    showTooltip: showTooltip && !(isTouchDevice() && hideTooltip),
    hideTooltip,
    tooltipId,
    anchorId,
    handleTooltipTrigger,
    setupTouchHandlers
  };
};