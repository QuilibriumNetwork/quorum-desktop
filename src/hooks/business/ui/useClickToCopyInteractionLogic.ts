import * as React from 'react';

interface InteractionAdapter {
  setupEventListeners: (
    elementId: string,
    onCopy: () => void,
    touchTrigger: 'click' | 'long-press',
    longPressDuration: number
  ) => () => void; // Returns cleanup function
  isTouch: boolean;
}

interface UseClickToCopyInteractionLogicOptions {
  touchTrigger?: 'click' | 'long-press';
  longPressDuration?: number;
  onCopy: () => void;
}

interface UseClickToCopyInteractionLogicReturn {
  setupInteraction: (elementId: string) => void;
  isTouch: boolean;
}

export const useClickToCopyInteractionLogic = (
  adapter: InteractionAdapter,
  options: UseClickToCopyInteractionLogicOptions
): UseClickToCopyInteractionLogicReturn => {
  const { touchTrigger = 'click', longPressDuration = 700, onCopy } = options;

  const setupInteraction = React.useCallback(
    (elementId: string) => {
      if (!adapter.isTouch) return;

      const cleanup = adapter.setupEventListeners(
        elementId,
        onCopy,
        touchTrigger,
        longPressDuration
      );

      return cleanup;
    },
    [adapter, onCopy, touchTrigger, longPressDuration]
  );

  return {
    setupInteraction,
    isTouch: adapter.isTouch,
  };
};