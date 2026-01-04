import React, { createContext, useContext, ReactNode } from 'react';
import { useDragState, ActiveDragItem, DropTarget } from '../hooks/business/ui/useDragState';

interface DragStateContextType {
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  activeItem: ActiveDragItem | null;
  setActiveItem: (item: ActiveDragItem | null) => void;
  dropTarget: DropTarget | null;
  setDropTarget: (target: DropTarget | null) => void;
  isContextMenuOpen: boolean;
  setIsContextMenuOpen: (open: boolean) => void;
}

const DragStateContext = createContext<DragStateContextType | undefined>(
  undefined
);

interface DragStateProviderProps {
  children: ReactNode;
}

export const DragStateProvider: React.FC<DragStateProviderProps> = ({
  children,
}) => {
  const dragState = useDragState();

  return (
    <DragStateContext.Provider value={dragState}>
      {children}
    </DragStateContext.Provider>
  );
};

export const useDragStateContext = (): DragStateContextType => {
  const context = useContext(DragStateContext);
  if (context === undefined) {
    throw new Error(
      'useDragStateContext must be used within a DragStateProvider'
    );
  }
  return context;
};
