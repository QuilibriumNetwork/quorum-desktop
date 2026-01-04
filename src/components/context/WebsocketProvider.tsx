import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { getConfig } from '../../config/config';
import { EncryptedMessage } from '../../db/messages';
import { t } from '@lingui/core/macro';
import { notificationService } from '../../services/NotificationService';

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

// Grace period before reporting disconnect (prevents flicker during reconnection)
const DISCONNECT_GRACE_MS = 3000;

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef<MessageHandler | null>(null);
  const resubscribeRef = useRef<(() => Promise<void>) | null>(null);
  // Separate locks for inbound and outbound processing to prevent blocking
  const inboundProcessingRef = useRef(false);
  const outboundProcessingRef = useRef(false);
  const lastNotificationTime = useRef<number>(0);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messageQueue = useRef<EncryptedMessage[]>([]);
  const outboundQueue = useRef<OutboundMessage[]>([]);

  const dequeue = () => {
    if (messageQueue.current.length === 0) return undefined;
    const message = messageQueue.current[0];
    messageQueue.current = messageQueue.current.slice(1);
    return message;
  };

  const dequeueOutbound = () => {
    if (outboundQueue.current.length === 0) return undefined;
    const message = outboundQueue.current[0];
    outboundQueue.current = outboundQueue.current.slice(1);
    return message;
  };

  const showNotificationForNewMessages = () => {
    const now = Date.now();
    const timeSinceLastNotification = now - lastNotificationTime.current;

    // Throttle notifications to avoid spam - only show one notification per 5 seconds
    if (timeSinceLastNotification < 5000) {
      return;
    }

    lastNotificationTime.current = now;
    const { count, metadata } = notificationService.getPendingNotificationData();
    if (count > 0) {
      notificationService.showContextualNotification(count, metadata);
    }
  };

  // Process inbound messages independently from outbound
  const processInbound = async () => {
    if (inboundProcessingRef.current || !handlerRef.current) {
      return;
    }

    inboundProcessingRef.current = true;
    let message: EncryptedMessage | undefined;

    try {
      const inboxMap = new Map<string, EncryptedMessage[]>();

      // Group messages by inbox address
      while ((message = dequeue())) {
        if (!inboxMap.has(message.inboxAddress)) {
          inboxMap.set(message.inboxAddress, []);
        }

        const messages = inboxMap.get(message.inboxAddress);
        messages!.push(message);
        inboxMap.set(message.inboxAddress, messages!);
      }

      const allPromises = [] as Promise<void>[];

      // Reset notification count before processing batch
      notificationService.resetPendingNotificationCount();

      for (const [_, messages] of inboxMap) {
        allPromises.push(
          (async () => {
            for (const message of messages) {
              try {
                await handlerRef.current!(message);
              } catch (error) {
                console.error(t`Error processing inbound:`, error);
              }
            }
          })()
        );
      }

      await Promise.allSettled(allPromises);

      // Show contextual notification for new messages
      showNotificationForNewMessages();
    } catch (error) {
      console.error(t`Error processing inbound queue:`, error);
    } finally {
      inboundProcessingRef.current = false;
    }
  };

  // Process outbound messages independently from inbound
  const processOutbound = async () => {
    if (outboundProcessingRef.current) {
      return;
    }

    outboundProcessingRef.current = true;
    let outbound: OutboundMessage | undefined;

    try {
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
      console.error(t`Error processing outbound queue:`, error);
    } finally {
      outboundProcessingRef.current = false;
    }
  };

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(getConfig().quorumWsUrl);

      ws.onopen = () => {
        // Cancel any pending disconnect timer - we reconnected in time
        if (disconnectTimerRef.current) {
          clearTimeout(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
        }
        setConnected(true);
        if (resubscribeRef.current) resubscribeRef.current();
        // Process any pending messages on reconnect
        processInbound();
        processOutbound();
      };

      ws.onclose = () => {
        // Delay reporting disconnect to avoid flicker during quick reconnects
        if (!disconnectTimerRef.current) {
          disconnectTimerRef.current = setTimeout(() => {
            setConnected(false);
            disconnectTimerRef.current = null;
          }, DISCONNECT_GRACE_MS);
        }
        setTimeout(connect, 1000);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as EncryptedMessage;
          messageQueue.current = [...messageQueue.current, message];
          processInbound(); // Only process inbound - outbound is independent
        } catch (error) {
          console.error(t`Failed to parse WebSocket message:`, error);
        }
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, []);

  useEffect(() => {
    const i = setInterval(() => {
      // Periodic check for any queued messages
      processInbound();
      processOutbound();
    }, 1000);

    return () => {
      clearInterval(i);
    };
  }, []);

  const enqueueOutbound = (message: OutboundMessage) => {
    outboundQueue.current = [...outboundQueue.current, message];
    processOutbound(); // Only process outbound - independent from inbound
  };

  const setMessageHandler = (handler: MessageHandler) => {
    handlerRef.current = handler;
    processInbound(); // Process any queued inbound messages now that handler is set
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
