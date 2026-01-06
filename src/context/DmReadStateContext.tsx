import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface DmReadStateContextType {
  /**
   * Timestamp when "mark all as read" was triggered.
   * Any conversation with lastReadTimestamp < this value should be considered read.
   * null means no bulk mark-as-read is active.
   */
  markAllReadTimestamp: number | null;
  /**
   * Call this to immediately mark all DMs as read in the UI.
   * Returns the timestamp used so callers can persist it to DB.
   */
  markAllAsRead: () => number;
  /**
   * Clear the forced read state (called when data syncs naturally)
   */
  clearMarkAllRead: () => void;
}

const DmReadStateContext = createContext<DmReadStateContextType | undefined>(undefined);

interface DmReadStateProviderProps {
  children: ReactNode;
}

export const DmReadStateProvider: React.FC<DmReadStateProviderProps> = ({ children }) => {
  const [markAllReadTimestamp, setMarkAllReadTimestamp] = useState<number | null>(null);

  const markAllAsRead = useCallback(() => {
    const now = Date.now();
    setMarkAllReadTimestamp(now);
    return now;
  }, []);

  const clearMarkAllRead = useCallback(() => {
    setMarkAllReadTimestamp(null);
  }, []);

  return (
    <DmReadStateContext.Provider value={{ markAllReadTimestamp, markAllAsRead, clearMarkAllRead }}>
      {children}
    </DmReadStateContext.Provider>
  );
};

export const useDmReadState = (): DmReadStateContextType => {
  const context = useContext(DmReadStateContext);
  if (context === undefined) {
    throw new Error('useDmReadState must be used within a DmReadStateProvider');
  }
  return context;
};

/**
 * Helper hook to check if a conversation should be considered "read" based on context override.
 * Use this in components that display unread state.
 *
 * @param lastReadTimestamp - The conversation's lastReadTimestamp from DB/cache
 * @param messageTimestamp - The conversation's last message timestamp
 * @returns true if the conversation has unread messages (considering context override)
 */
export const useIsConversationUnread = (
  lastReadTimestamp: number | null | undefined,
  messageTimestamp: number
): boolean => {
  const { markAllReadTimestamp } = useDmReadState();

  // If mark-all-read was triggered, use that timestamp as the read marker
  const effectiveReadTimestamp = markAllReadTimestamp
    ? Math.max(lastReadTimestamp ?? 0, markAllReadTimestamp)
    : (lastReadTimestamp ?? 0);

  return effectiveReadTimestamp < messageTimestamp;
};
