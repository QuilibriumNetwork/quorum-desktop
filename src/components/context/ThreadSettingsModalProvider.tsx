import React, { createContext, useContext, ReactNode } from 'react';
import type { Message as MessageType } from '../../api/quorumApi';
import type { ThreadChannelProps } from './ThreadContext';

export interface ThreadSettingsModalConfig {
  threadId: string;
  rootMessage: MessageType;
  threadMessages: MessageType[];
  channelProps: ThreadChannelProps | null;
  setThreadClosed?: (threadId: string, close: boolean) => Promise<void>;
  updateThreadSettings?: (threadId: string, autoCloseAfter: number | undefined) => Promise<void>;
  removeThread?: (threadId: string) => Promise<void>;
}

interface ThreadSettingsModalContextType {
  openThreadSettings: (config: ThreadSettingsModalConfig) => void;
}

const ThreadSettingsModalContext = createContext<ThreadSettingsModalContextType | undefined>(undefined);

export const useThreadSettingsModal = () => {
  const context = useContext(ThreadSettingsModalContext);
  if (!context) {
    throw new Error('useThreadSettingsModal must be used within ThreadSettingsModalProvider');
  }
  return context;
};

interface ThreadSettingsModalProviderProps {
  children: ReactNode;
  openThreadSettings: (config: ThreadSettingsModalConfig) => void;
}

export const ThreadSettingsModalProvider: React.FC<ThreadSettingsModalProviderProps> = ({
  children,
  openThreadSettings,
}) => {
  return (
    <ThreadSettingsModalContext.Provider value={{ openThreadSettings }}>
      {children}
    </ThreadSettingsModalContext.Provider>
  );
};
