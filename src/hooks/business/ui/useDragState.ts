import { useState, useCallback } from 'react';

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

export const useDragState = (): UseDragStateReturn => {
  const [isDragging, setIsDraggingState] = useState(false);
  const [activeItem, setActiveItemState] = useState<ActiveDragItem | null>(null);
  const [dropTarget, setDropTargetState] = useState<DropTarget | null>(null);

  const setIsDragging = useCallback((dragging: boolean) => {
    setIsDraggingState(dragging);
  }, []);

  const setActiveItem = useCallback((item: ActiveDragItem | null) => {
    setActiveItemState(item);
  }, []);

  const setDropTarget = useCallback((target: DropTarget | null) => {
    setDropTargetState(target);
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
