interface InteractionAdapter {
  setupEventListeners: (
    elementId: string,
    onCopy: () => void,
    touchTrigger: 'click' | 'long-press',
    longPressDuration: number
  ) => () => void;
  isTouch: boolean;
}

export const useInteractionAdapter = (): InteractionAdapter => {
  const setupEventListeners = (
    elementId: string,
    onCopy: () => void,
    touchTrigger: 'click' | 'long-press',
    longPressDuration: number
  ): (() => void) => {
    // For React Native, we'll handle interactions through component props
    // This adapter is used in the native component to maintain consistency
    // The actual gesture handling is done in the native component itself
    
    // Return empty cleanup function since React Native handles cleanup automatically
    return () => {};
  };

  return {
    setupEventListeners,
    isTouch: true, // Native is always touch-based
  };
};