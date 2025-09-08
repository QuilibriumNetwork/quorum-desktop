import React, { createContext, useContext, useState, ReactNode } from 'react';

// Sidebar state interface
interface SidebarState {
  showRightSidebar: boolean;
  rightSidebarContent: ReactNode;
}

// Context interface
interface SidebarContextType {
  showRightSidebar: boolean;
  setShowRightSidebar: (show: boolean) => void;
  rightSidebarContent: ReactNode;
  setRightSidebarContent: (content: ReactNode) => void;
}

// Context
const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

// Hook
export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return context;
};

// Provider props
interface SidebarProviderProps {
  children: ReactNode;
}

// Provider component
export const SidebarProvider: React.FC<SidebarProviderProps> = ({
  children,
}) => {
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [rightSidebarContent, setRightSidebarContent] =
    useState<ReactNode>(null);

  const contextValue: SidebarContextType = {
    showRightSidebar,
    setShowRightSidebar,
    rightSidebarContent,
    setRightSidebarContent,
  };

  return (
    <SidebarContext.Provider value={contextValue}>
      {children}
    </SidebarContext.Provider>
  );
};
