import { useState, useCallback, useRef } from 'react';
import { hapticLight } from '../../../utils/haptic';
import { isTouchDevice } from '../../../utils/platform';

export interface ActiveDragItem {
  id: string;
  type: 'space' | 'folder';
}

export type DropIntent = 'merge' | 'reorder-before' | 'reorder-after' | null;

export interface DropTarget {
  id: string;
  type: 'space' | 'folder';
  intent: DropIntent;
  parentFolderId?: string; // If target is inside a folder
}

interface UseDragStateReturn {
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  activeItem: ActiveDragItem | null;
  setActiveItem: (item: ActiveDragItem | null) => void;
  dropTarget: DropTarget | null;
  setDropTarget: (target: DropTarget | null) => void;
}

// Delay before clearing isDragging after drop to prevent tooltip flash during crypto freeze
const DRAG_END_TOOLTIP_DELAY_MS = 3000;

export const useDragState = (): UseDragStateReturn => {
  const [isDragging, setIsDraggingState] = useState(false);
  const [activeItem, setActiveItemState] = useState<ActiveDragItem | null>(null);
  const [dropTarget, setDropTargetState] = useState<DropTarget | null>(null);
  const dragEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setIsDragging = useCallback((dragging: boolean) => {
    // Clear any pending timeout
    if (dragEndTimeoutRef.current) {
      clearTimeout(dragEndTimeoutRef.current);
      dragEndTimeoutRef.current = null;
    }

    if (dragging) {
      // Start dragging immediately
      setIsDraggingState(true);
    } else {
      // Delay clearing isDragging to prevent tooltip flash during crypto operations
      dragEndTimeoutRef.current = setTimeout(() => {
        setIsDraggingState(false);
        dragEndTimeoutRef.current = null;
      }, DRAG_END_TOOLTIP_DELAY_MS);
    }
  }, []);

  const setActiveItem = useCallback((item: ActiveDragItem | null) => {
    setActiveItemState(item);
  }, []);

  const setDropTarget = useCallback((target: DropTarget | null) => {
    // Trigger haptic feedback on touch devices when drop target changes
    // This provides tactile feedback when separator appears or merge wiggle activates
    setDropTargetState((prevTarget) => {
      if (isTouchDevice() && target !== null) {
        // Check if this is a meaningful change (new target or different intent)
        const isNewTarget = !prevTarget || prevTarget.id !== target.id;
        const isNewIntent = prevTarget && prevTarget.id === target.id && prevTarget.intent !== target.intent;

        if (isNewTarget || isNewIntent) {
          hapticLight();
        }
      }
      return target;
    });
  }, []);

  return {
    isDragging,
    setIsDragging,
    activeItem,
    setActiveItem,
    dropTarget,
    setDropTarget,
  };
};
