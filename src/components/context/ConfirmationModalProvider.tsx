import React, { createContext, useContext, ReactNode } from 'react';

// Context interface
interface ConfirmationModalContextType {
  showConfirmationModal: (config: {
    title: string;
    message: string;
    preview?: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    protipAction?: string;
    onConfirm: () => void;
  }) => void;
}

// Context
const ConfirmationModalContext = createContext<ConfirmationModalContextType | undefined>(undefined);

// Hook
export const useConfirmationModal = () => {
  const context = useContext(ConfirmationModalContext);
  if (!context) {
    throw new Error('useConfirmationModal must be used within ConfirmationModalProvider');
  }
  return context;
};

// Provider props
interface ConfirmationModalProviderProps {
  children: ReactNode;
  showConfirmationModal: (config: {
    title: string;
    message: string;
    preview?: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    protipAction?: string;
    onConfirm: () => void;
  }) => void;
}

// Provider component
export const ConfirmationModalProvider: React.FC<ConfirmationModalProviderProps> = ({
  children,
  showConfirmationModal,
}) => {
  const contextValue: ConfirmationModalContextType = {
    showConfirmationModal,
  };

  return (
    <ConfirmationModalContext.Provider value={contextValue}>
      {children}
    </ConfirmationModalContext.Provider>
  );
};