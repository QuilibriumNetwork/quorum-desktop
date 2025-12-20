/**
 * ActionQueueContext - React context for action queue state
 *
 * Provides:
 * - Queue statistics (pending, processing, failed counts)
 * - Online/offline status (combines WebSocket + navigator.onLine)
 * - Automatic refresh on queue updates
 *
 * Online detection uses WebSocket connection state as primary signal
 * because navigator.onLine is unreliable on Wi-Fi disconnect in Chromium
 * browsers. See: .agents/tasks/offline-detection-and-optimistic-message-reliability.md
 *
 * See: .agents/tasks/background-action-queue.md
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import type { QueueStats } from '../../types/actionQueue';
import type { ActionQueueService } from '../../services/ActionQueueService';
import { useWebSocket } from './WebsocketProvider';

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

  // Get WebSocket connection state (most reliable for Wi-Fi disconnect)
  const { connected: wsConnected } = useWebSocket();

  // Get navigator.onLine state (reliable for false, unreliable for true)
  const [navOnline, setNavOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Combined: offline if EITHER signal says offline
  const isOnline = wsConnected && navOnline;

  // Keep ref updated for the callback (avoids stale closure)
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;

  // Wire up isOnline callback to ActionQueueService
  useEffect(() => {
    if (actionQueueService) {
      actionQueueService.setIsOnlineCallback(() => isOnlineRef.current);
    }
  }, [actionQueueService]);

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

  // Listen to navigator.onLine events (defense in depth for captive portals, airplane mode)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setNavOnline(true);
    const handleOffline = () => setNavOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Trigger queue processing when coming back online
  useEffect(() => {
    if (isOnline) {
      actionQueueService?.processQueue();
    }
  }, [isOnline, actionQueueService]);

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
