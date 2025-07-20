import React, { createContext, useContext } from 'react';
import {
  useResponsiveLayout,
  ResponsiveLayoutState,
} from '../../hooks/useResponsiveLayout';

const ResponsiveLayoutContext = createContext<
  ResponsiveLayoutState | undefined
>(undefined);

interface ResponsiveLayoutProviderProps {
  children: React.ReactNode;
}

export const ResponsiveLayoutProvider: React.FC<
  ResponsiveLayoutProviderProps
> = ({ children }) => {
  const responsiveLayout = useResponsiveLayout();

  return (
    <ResponsiveLayoutContext.Provider value={responsiveLayout}>
      {children}
    </ResponsiveLayoutContext.Provider>
  );
};

export const useResponsiveLayoutContext = (): ResponsiveLayoutState => {
  const context = useContext(ResponsiveLayoutContext);
  if (context === undefined) {
    throw new Error(
      'useResponsiveLayoutContext must be used within a ResponsiveLayoutProvider'
    );
  }
  return context;
};
