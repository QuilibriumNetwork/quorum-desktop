import { useState, useCallback } from 'react';

export function useScrollTracking() {
  const [isViewingOlderMessages, setIsViewingOlderMessages] = useState(false);

  // Handle bottom state changes from Virtuoso
  // When atBottomThreshold is set to our pixel threshold ,
  // Virtuoso will call this with false when user scrolls > px-threshold from bottom
  const handleAtBottomStateChange = useCallback((atBottom: boolean) => {
    // Simple: if not at bottom (considering our 1500px threshold), show button
    setIsViewingOlderMessages(!atBottom);
  }, []);

  return {
    handleAtBottomStateChange,
    // Simple boolean - show button when viewing older messages
    shouldShowJumpButton: isViewingOlderMessages,
  };
}
