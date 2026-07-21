import { useMemo, useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router';
import { usePasskeysContext } from '@quilibrium/quilibrium-js-sdk-channels';
import { useMessages } from '../../queries/messages/useMessages';
import { useInvalidateConversation } from '../../queries/conversation/useInvalidateConversation';
import { useMessageDB } from '../../../components/context/useMessageDB';
import type { Message as MessageType } from '@quilibrium/quorum-shared';

export interface UseDirectMessagesListReturn {
  messageList: MessageType[];
  acceptChat: boolean;
  fetchNextPage: () => void;
  fetchPreviousPage: () => void;
  hasNextPage?: boolean;
  saveReadTime: () => void;
  canDeleteMessages: (message: MessageType) => boolean;
}

/**
 * Hook for managing DirectMessage message list and chat acceptance state
 */
export function useDirectMessagesList(): UseDirectMessagesListReturn {
  const { address } = useParams<{ address: string }>();
  const user = usePasskeysContext();
  const conversationId = address! + '/' + address!;
  const [acceptChat, setAcceptChat] = useState(false);

  const { messageDB } = useMessageDB();
  const invalidateConversation = useInvalidateConversation();

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

  // Save read time is handled by DirectMessage.tsx's periodic interval + unmount save.
  // Removed the messageList-triggered effect here because it caused cascading re-renders
  // (invalidateConversation) that disrupted Virtuoso's scroll measurement cycle.

  const saveReadTime = () => {
    if (messageList.length > 0) {
      const latestTimestamp = Math.max(
        ...messageList.map((msg) => msg.createdDate || 0)
      );
      messageDB.saveReadTime({
        conversationId,
        lastMessageTimestamp: latestTimestamp,
      });
      invalidateConversation({ conversationId });
    }
  };

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
    saveReadTime,
    canDeleteMessages,
  };
}
