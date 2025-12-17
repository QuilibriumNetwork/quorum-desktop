/**
 * ActionQueueContext - React context for action queue state
 *
 * Provides:
 * - Queue statistics (pending, processing, failed counts)
 * - Online/offline status
 * - Automatic refresh on queue updates
 *
 * See: .agents/tasks/background-action-queue.md
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import type { QueueStats } from '../../types/actionQueue';
import type { ActionQueueService } from '../../services/ActionQueueService';

// Context interface
interface ActionQueueContextType {
  stats: QueueStats;
  isOnline: boolean;
  refreshStats: () => Promise<void>;
}

// Default stats
const defaultStats: QueueStats = {
  pending: 0,
  processing: 0,
  failed: 0,
  completed: 0,
  total: 0,
};

// Context
const ActionQueueContext = createContext<ActionQueueContextType | undefined>(
  undefined
);

// Hook
export const useActionQueue = () => {
  const context = useContext(ActionQueueContext);
  if (!context) {
    throw new Error('useActionQueue must be used within ActionQueueProvider');
  }
  return context;
};

// Provider props
interface ActionQueueProviderProps {
  children: ReactNode;
  actionQueueService: ActionQueueService | null;
}

// Provider component
export const ActionQueueProvider: React.FC<ActionQueueProviderProps> = ({
  children,
  actionQueueService,
}) => {
  const [stats, setStats] = useState<QueueStats>(defaultStats);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const refreshStats = useCallback(async () => {
    if (actionQueueService) {
      const newStats = await actionQueueService.getStats();
      setStats(newStats);
    }
  }, [actionQueueService]);

  // Listen for queue updates from ActionQueueService
  useEffect(() => {
    const handleQueueUpdated = () => {
      refreshStats();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('quorum:queue-updated', handleQueueUpdated);
      return () => {
        window.removeEventListener('quorum:queue-updated', handleQueueUpdated);
      };
    }
  }, [refreshStats]);

  // Online/offline detection
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      // Trigger queue processing when back online
      actionQueueService?.processQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [actionQueueService]);

  // Initial stats load
  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  const contextValue: ActionQueueContextType = {
    stats,
    isOnline,
    refreshStats,
  };

  return (
    <ActionQueueContext.Provider value={contextValue}>
      {children}
    </ActionQueueContext.Provider>
  );
};
