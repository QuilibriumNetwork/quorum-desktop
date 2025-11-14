import { useState, useCallback } from 'react';

interface UseScrollTrackingOptions {
  messageCount?: number;
  minMessageCount?: number;
}

export function useScrollTracking(options: UseScrollTrackingOptions = {}) {
  const { messageCount = 0, minMessageCount = 10 } = options;
  const [isViewingOlderMessages, setIsViewingOlderMessages] = useState(false);

  // Handle bottom state changes from Virtuoso
  // When atBottomThreshold is set to our pixel threshold,
  // Virtuoso will call this with false when user scrolls > px-threshold from bottom
  const handleAtBottomStateChange = useCallback((atBottom: boolean) => {
    // Simple: if not at bottom (considering our threshold), show button
    setIsViewingOlderMessages(!atBottom);
  }, []);

  // Only show button if:
  // 1. User is viewing older messages (scrolled away from bottom)
  // 2. There are enough messages to warrant showing the button
  const shouldShowJumpButton = isViewingOlderMessages && messageCount >= minMessageCount;

  return {
    handleAtBottomStateChange,
    shouldShowJumpButton,
  };
}
