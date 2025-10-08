import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';
import { ActionQueueService } from '../../services/ActionQueueService';
import { createSendMessageHandler } from '../../actions/handlers/sendMessage';
import { createSaveUserConfigHandler } from '../../actions/handlers/saveUserConfig';
import { createKickUserHandler } from '../../actions/handlers/kickUser';
import { useMessageDB } from './useMessageDB';
import { useQueryClient } from '@tanstack/react-query';

type ContextValue = {
  addAction: (taskType: 'send-message' | 'save-user-config' | 'kick-user', context: any, key: string) => Promise<number>;
  isProcessing: boolean;
  counts: { pending: number; processing: number; failed: number };
};

const ActionQueueContext = createContext<ContextValue>({
  addAction: async () => -1,
  isProcessing: false,
  counts: { pending: 0, processing: 0, failed: 0 },
});

export const ActionQueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { messageDB } = useMessageDB();
  const queryClient = useQueryClient();

  // Pull needed services/refs from MessageDB context providers via hooks
  // We build handlers by reading from MessageDB provider runtime wiring
  const messageDBContext = require('./MessageDB');
  const useMDB = messageDBContext.useMessageDB || (() => ({ }));
  const {
    submitChannelMessage,
    saveConfig,
    // SpaceService methods are proxied via MessageDB context
  } = useMDB();

  const messageService = { submitChannelMessage } as any;
  const configService = { saveConfig } as any;
  const spaceService = (useMDB() as any)?.spaceService || {};

  const handlers = useMemo(() => ({
    'send-message': createSendMessageHandler({ messageDB, messageService, queryClient, currentPasskeyInfo: (useMDB() as any)?.keyset ? (useMDB() as any)?.keyset?.currentPasskeyInfo : (useMDB() as any)?.currentPasskeyInfo }),
    'save-user-config': createSaveUserConfigHandler({ configService }),
    'kick-user': createKickUserHandler({ spaceService, queryClient }),
  }), [messageDB, messageService, configService, spaceService, queryClient]);

  const [service] = useState(() => new ActionQueueService({ handlers, messageDB }));
  const [isProcessing, setIsProcessing] = useState(false);
  const [counts, setCounts] = useState({ pending: 0, processing: 0, failed: 0 });

  const refreshCounts = useCallback(async () => {
    const pending = (await messageDB.getQueueTasksByStatus('pending')).length;
    const processing = (await messageDB.getQueueTasksByStatus('processing')).length;
    const failed = (await messageDB.getQueueTasksByStatus('failed')).length;
    setCounts({ pending, processing, failed });
  }, [messageDB]);

  const addAction = useCallback(async (taskType: any, context: any, key: string) => {
    const id = await service.addTask(taskType, context, key);
    refreshCounts();
    return id;
  }, [service, refreshCounts]);

  useEffect(() => {
    const handleOnline = () => service.processQueue();
    const handleOffline = () => {};
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    // Kick off processing at mount
    service.processQueue();
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [service]);

  useEffect(() => {
    const onQueueUpdated = () => refreshCounts();
    (window as any).addEventListener('quorum:queue-updated', onQueueUpdated);
    refreshCounts();
    return () => {
      (window as any).removeEventListener('quorum:queue-updated', onQueueUpdated);
    };
  }, [refreshCounts]);

  return (
    <ActionQueueContext.Provider value={{ addAction, isProcessing, counts }}>
      {children}
    </ActionQueueContext.Provider>
  );
};

export const useActionQueue = () => useContext(ActionQueueContext);
export { ActionQueueContext };


