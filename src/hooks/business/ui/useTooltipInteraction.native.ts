import { useState, useRef, useCallback } from 'react';

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
  setupTouchHandlers: (element: any) => void; // Accept any for compatibility
}

export const useTooltipInteraction = (
  options: UseTooltipInteractionOptions = {}
): UseTooltipInteractionReturn => {
  const { hideDelay = 3000 } = options;

  const [showTooltip, setShowTooltip] = useState(true);
  const [hideTooltip, setHideTooltip] = useState(false);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Generate unique IDs for tooltip and anchor
  const tooltipId = useRef(
    `tooltip-${Math.random().toString(36).slice(2, 10)}`
  ).current;
  const anchorId = useRef(
    `anchor-${Math.random().toString(36).slice(2, 10)}`
  ).current;

  const handleTooltipTrigger = useCallback(() => {
    setShowTooltip(true);
    setHideTooltip(false);

    // On native, always auto-hide after delay (native is always touch)
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    hideTimerRef.current = setTimeout(() => {
      setHideTooltip(true);
      setShowTooltip(false);
    }, hideDelay);
  }, [hideDelay]);

  const setupTouchHandlers = useCallback((element: any) => {
    // Native doesn't need manual touch handler setup
    // Touch handling is managed by TouchableOpacity/TouchableWithoutFeedback in components
    return () => {}; // Return empty cleanup function
  }, []);

  return {
    showTooltip: !hideTooltip, // Native is always touch, so respect hideTooltip state
    hideTooltip,
    tooltipId,
    anchorId,
    handleTooltipTrigger,
    setupTouchHandlers,
  };
};
