import React, { createContext, useContext, ReactNode } from 'react';
import type { Message as MessageType } from '../../api/quorumApi';

// Context interface
interface EditHistoryModalContextType {
  showEditHistoryModal: (message: MessageType) => void;
}

// Context
const EditHistoryModalContext = createContext<EditHistoryModalContextType | undefined>(undefined);

// Hook
export const useEditHistoryModal = () => {
  const context = useContext(EditHistoryModalContext);
  if (!context) {
    throw new Error('useEditHistoryModal must be used within EditHistoryModalProvider');
  }
  return context;
};

// Provider props
interface EditHistoryModalProviderProps {
  children: ReactNode;
  showEditHistoryModal: (message: MessageType) => void;
}

// Provider component
export const EditHistoryModalProvider: React.FC<EditHistoryModalProviderProps> = ({
  children,
  showEditHistoryModal,
}) => {
  const contextValue: EditHistoryModalContextType = {
    showEditHistoryModal,
  };

  return (
    <EditHistoryModalContext.Provider value={contextValue}>
      {children}
    </EditHistoryModalContext.Provider>
  );
};
