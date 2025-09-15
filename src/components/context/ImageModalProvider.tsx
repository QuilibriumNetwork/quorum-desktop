import React, { createContext, useContext, ReactNode } from 'react';

// Context interface
interface ImageModalContextType {
  showImageModal: (imageUrl: string) => void;
}

// Context
const ImageModalContext = createContext<ImageModalContextType | undefined>(undefined);

// Hook
export const useImageModal = () => {
  const context = useContext(ImageModalContext);
  if (!context) {
    throw new Error('useImageModal must be used within ImageModalProvider');
  }
  return context;
};

// Provider props
interface ImageModalProviderProps {
  children: ReactNode;
  showImageModal: (imageUrl: string) => void;
}

// Provider component
export const ImageModalProvider: React.FC<ImageModalProviderProps> = ({
  children,
  showImageModal,
}) => {
  const contextValue: ImageModalContextType = {
    showImageModal,
  };

  return (
    <ImageModalContext.Provider value={contextValue}>
      {children}
    </ImageModalContext.Provider>
  );
};