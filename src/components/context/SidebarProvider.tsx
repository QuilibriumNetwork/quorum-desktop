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
export const SidebarProvider: React.FC<SidebarProviderProps> = ({ children }) => {
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [rightSidebarContent, setRightSidebarContent] = useState<ReactNode>(null);

  const contextValue: SidebarContextType = {
    showRightSidebar,
    setShowRightSidebar,
    rightSidebarContent,
    setRightSidebarContent,
  };

  return (
    <SidebarContext.Provider value={contextValue}>
      {/* Render sidebar overlay for mobile */}
      {showRightSidebar && (
        <div
          className="fixed inset-0 bg-mobile-overlay z-[9999] lg:hidden"
          onClick={() => setShowRightSidebar(false)}
        />
      )}

      {/* Render sidebar content */}
      {rightSidebarContent && (
        <div
          className={
            'w-[260px] bg-mobile-sidebar mobile-sidebar-right overflow-scroll ' +
            'transition-transform duration-300 ease-in-out ' +
            (showRightSidebar ? 'translate-x-0' : 'translate-x-full') +
            ' fixed top-0 right-0 h-full z-[10000] lg:hidden'
          }
        >
          {rightSidebarContent}
        </div>
      )}

      {children}
    </SidebarContext.Provider>
  );
};