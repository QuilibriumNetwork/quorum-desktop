import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useQuorumApiClient } from './QuorumApiContext';
import { getConfig } from '../../config/config';
import { EncryptedMessage } from '../../db/messages';
import { t } from '@lingui/core/macro';
import { notificationService } from '../../services/notificationService';

type MessageHandler = (message: EncryptedMessage) => Promise<void>;
type OutboundMessage = () => Promise<string[]>;

interface WebSocketContextValue {
  connected: boolean;
  setMessageHandler: (handler: MessageHandler) => void;
  enqueueOutbound: (message: OutboundMessage) => void;
  setResubscribe: (resubscribe: () => Promise<void>) => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef<MessageHandler | null>(null);
  const resubscribeRef = useRef<(() => Promise<void>) | null>(null);
  const processingRef = useRef(false);
  const lastNotificationTime = useRef<number>(0);

  const messageQueue = useRef<EncryptedMessage[]>([]);
  const outboundQueue = useRef<OutboundMessage[]>([]);

  const dequeue = () => {
    let message: EncryptedMessage | undefined;

    if (messageQueue.current.length === 0) return undefined;
    message = messageQueue.current[0];
    messageQueue.current = messageQueue.current.slice(1);

    return message;
  };

  const dequeueOutbound = () => {
    let message: OutboundMessage | undefined;

    if (outboundQueue.current.length === 0) return undefined;
    message = outboundQueue.current[0];
    outboundQueue.current = outboundQueue.current.slice(1);

    return message;
  };

  const showNotificationForNewMessages = (messageCount: number) => {
    const now = Date.now();
    const timeSinceLastNotification = now - lastNotificationTime.current;

    // Throttle notifications to avoid spam - only show one notification per 5 seconds
    if (timeSinceLastNotification < 5000) {
      return;
    }

    lastNotificationTime.current = now;
    notificationService.showUnreadMessagesNotification(messageCount);
  };

  const processQueue = async () => {
    if (processingRef.current || !handlerRef.current) {
      return;
    }

    processingRef.current = true;
    let message: EncryptedMessage | undefined;
    let outbound: OutboundMessage | undefined;

    try {
      let inboxMap = new Map<string, EncryptedMessage[]>();

      // Process inbound messages
      while ((message = dequeue())) {
        if (!inboxMap.has(message.inboxAddress)) {
          inboxMap.set(message.inboxAddress, []);
        }

        const messages = inboxMap.get(message.inboxAddress);
        messages!.push(message);
        inboxMap.set(message.inboxAddress, messages!);
      }

      let allPromises = [] as Promise<void>[];
      let totalNewMessages = 0;

      for (const [_, messages] of inboxMap) {
        totalNewMessages += messages.length;
        allPromises.push(
          new Promise(async (resolve) => {
            for (const message of messages) {
              try {
                await handlerRef.current!(message);
              } catch (error) {
                console.error(t`Error processing inbound:`, error);
              }
            }
            resolve();
          })
        );
      }

      await Promise.allSettled(allPromises);

      // Show notification for new messages if any were processed
      if (totalNewMessages > 0) {
        showNotificationForNewMessages(totalNewMessages);
      }

      // Process outbound messages only if socket is open
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        while ((outbound = dequeueOutbound())) {
          try {
            const messages = await outbound();
            for (const m of messages) {
              wsRef.current.send(m);
            }
          } catch (error) {
            console.error(t`Error processing outbound:`, error);
          }
        }
      }
    } catch (error) {
      console.error(t`Error processing queue:`, error);
    } finally {
      processingRef.current = false;
    }
  };

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(getConfig().quorumWsUrl);

      ws.onopen = () => {
        setConnected(true);
        if (resubscribeRef.current) resubscribeRef.current();
        processQueue(); // Process any pending outbound messages
      };

      ws.onclose = () => {
        setConnected(false);
        setTimeout(connect, 1000);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as EncryptedMessage;
          messageQueue.current = [...messageQueue.current, message];
          processQueue();
        } catch (error) {
          console.error(t`Failed to parse WebSocket message:`, error);
        }
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      wsRef.current?.close();
    };
  }, []);

  useEffect(() => {
    const i = setInterval(() => {
      processQueue();
    }, 1000);

    return () => {
      clearInterval(i);
    };
  }, []);

  const enqueueOutbound = (message: OutboundMessage) => {
    outboundQueue.current = [...outboundQueue.current, message];
    processQueue();
  };

  const setMessageHandler = (handler: MessageHandler) => {
    handlerRef.current = handler;
    processQueue();
  };

  const setResubscribe = (resubscribe: () => Promise<void>) => {
    resubscribeRef.current = resubscribe;
  };

  const value = {
    connected,
    setMessageHandler,
    enqueueOutbound,
    setResubscribe,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error(t`useWebSocket must be used within a WebSocketProvider`);
  }
  return context;
}
