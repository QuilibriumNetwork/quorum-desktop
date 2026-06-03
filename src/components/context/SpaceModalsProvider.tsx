import React, { createContext, useContext, ReactNode } from 'react';

interface SpaceModalsContextType {
  showAddSpaceModal: () => void;
  showCreateSpaceModal: () => void;
}

const SpaceModalsContext = createContext<SpaceModalsContextType | undefined>(
  undefined
);

export const useSpaceModals = (): SpaceModalsContextType => {
  const ctx = useContext(SpaceModalsContext);
  if (!ctx) {
    throw new Error(
      'useSpaceModals must be used within SpaceModalsProvider'
    );
  }
  return ctx;
};

interface SpaceModalsProviderProps {
  children: ReactNode;
  showAddSpaceModal: () => void;
  showCreateSpaceModal: () => void;
}

export const SpaceModalsProvider: React.FC<SpaceModalsProviderProps> = ({
  children,
  showAddSpaceModal,
  showCreateSpaceModal,
}) => (
  <SpaceModalsContext.Provider
    value={{ showAddSpaceModal, showCreateSpaceModal }}
  >
    {children}
  </SpaceModalsContext.Provider>
);
