import { useMemo, useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessages } from '../../queries/messages/useMessages';
import type { Message as MessageType } from '@quilibrium/quorum-shared';

export interface UseDirectMessagesListReturn {
  messageList: MessageType[];
  acceptChat: boolean;
  fetchNextPage: () => void;
  fetchPreviousPage: () => void;
  hasNextPage?: boolean;
  canDeleteMessages: (message: MessageType) => boolean;
}

/**
 * Hook for managing DirectMessage message list and chat acceptance state
 */
export function useDirectMessagesList(): UseDirectMessagesListReturn {
  const { address } = useParams<{ address: string }>();
  const user = usePasskeysContext();
  const [acceptChat, setAcceptChat] = useState(false);

  // Get messages for this conversation
  const {
    data: messages,
    fetchNextPage,
    fetchPreviousPage,
    hasNextPage,
  } = useMessages({ spaceId: address!, channelId: address! });

  // Process message list
  const messageList = useMemo(() => {
    return messages.pages.flatMap(
      (p) => (p as { messages: MessageType[] }).messages as MessageType[]
    );
  }, [messages]);

  // Determine if user has sent messages (auto-accept chat).
  // Re-evaluated whenever the message list changes so the "not accepted yet"
  // banner clears as soon as the user's reply lands, without a page refresh.
  // Only ever flips false → true (idempotent), so no cascading re-renders.
  useEffect(() => {
    const userAddress = user.currentPasskeyInfo?.address;
    if (!userAddress) return;
    const hasUserMessage = messageList.some(
      (m) => m.content.senderId === userAddress
    );
    if (hasUserMessage) {
      setAcceptChat(true);
    }
  }, [messageList, user.currentPasskeyInfo]);

  // Initial message loading
  useEffect(() => {
    if ((messages.pages[0] as any)?.messages?.length === 0) {
      fetchNextPage();
      fetchPreviousPage();
    }
  }, []);

  // Read time is written by DirectMessage.tsx's periodic interval + unmount save,
  // through useUpdateReadTime — the single write path. This hook used to export a
  // second `saveReadTime` that nothing consumed and that invalidated a different
  // set of query keys; it was deleted rather than wired up, because two divergent
  // read-time writers is how the read state drifts. If a new caller needs one,
  // use useUpdateReadTime.

  const canDeleteMessages = useCallback(
    (message: MessageType) => {
      const userAddress = user.currentPasskeyInfo?.address;
      if (!userAddress) return false;

      // Users can always delete their own messages (no time limit)
      if (message.content.senderId === userAddress) {
        return true;
      }

      return false;
    },
    [user.currentPasskeyInfo]
  );

  return {
    messageList,
    acceptChat,
    fetchNextPage,
    fetchPreviousPage,
    hasNextPage,
    canDeleteMessages,
  };
}
