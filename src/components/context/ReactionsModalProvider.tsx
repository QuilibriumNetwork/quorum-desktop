import React, { createContext, useContext, ReactNode } from 'react';
import type { Reaction } from '../../api/quorumApi';
import type { CustomEmoji } from 'emoji-picker-react/dist/config/customEmojiConfig';
import type { MemberInfo } from '../modals/ReactionsModal';

// Context interface
interface ReactionsModalContextType {
  showReactionsModal: (config: {
    reactions: Reaction[];
    customEmojis: CustomEmoji[];
    members: Record<string, MemberInfo>;
  }) => void;
}

// Context
const ReactionsModalContext = createContext<ReactionsModalContextType | undefined>(undefined);

// Hook
export const useReactionsModal = () => {
  const context = useContext(ReactionsModalContext);
  if (!context) {
    throw new Error('useReactionsModal must be used within ReactionsModalProvider');
  }
  return context;
};

// Provider props
interface ReactionsModalProviderProps {
  children: ReactNode;
  showReactionsModal: (config: {
    reactions: Reaction[];
    customEmojis: CustomEmoji[];
    members: Record<string, MemberInfo>;
  }) => void;
}

// Provider component
export const ReactionsModalProvider: React.FC<ReactionsModalProviderProps> = ({
  children,
  showReactionsModal,
}) => {
  const contextValue: ReactionsModalContextType = {
    showReactionsModal,
  };

  return (
    <ReactionsModalContext.Provider value={contextValue}>
      {children}
    </ReactionsModalContext.Provider>
  );
};
