import { useState, useCallback } from 'react';

interface UseDragStateReturn {
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
}

export const useDragState = (): UseDragStateReturn => {
  const [isDragging, setIsDraggingState] = useState(false);

  const setIsDragging = useCallback((dragging: boolean) => {
    setIsDraggingState(dragging);
  }, []);

  return {
    isDragging,
    setIsDragging,
  };
};
